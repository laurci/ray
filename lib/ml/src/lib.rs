pub use ndarray as nd;

use rand::rngs::StdRng;
use rand_distr::{Distribution, Normal};
use ray_shared::result::{bail, Result};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use nd::{Array1, Array2, Axis};

#[derive(Clone, Copy, PartialEq, Debug, Serialize, Deserialize)]
pub enum ActivationFunction {
    Sigmoid,
    ReLU,
    Linear,
}

impl ActivationFunction {
    pub fn activate(&self, x: &Array1<f32>) -> Array1<f32> {
        match self {
            ActivationFunction::Sigmoid => x.mapv(|x| 1.0 / (1.0 + (-x).exp())),
            ActivationFunction::ReLU => x.mapv(|x| x.max(0.0)),
            ActivationFunction::Linear => x.clone(),
        }
    }

    pub fn derivative(&self, x: &Array1<f32>) -> Array1<f32> {
        match self {
            ActivationFunction::Sigmoid => {
                let a = self.activate(x);
                &a * &(1.0 - &a)
            }
            ActivationFunction::ReLU => x.mapv(|x| if x > 0.0 { 1.0 } else { 0.0 }),
            ActivationFunction::Linear => Array1::ones(x.len()),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Layer {
    pub weights: Vec<Vec<f32>>,
    pub biases: Vec<f32>,
    pub activation: ActivationFunction,
}

impl Layer {
    pub fn new(
        input_size: usize,
        output_size: usize,
        activation: ActivationFunction,
        rng: &mut StdRng,
    ) -> Self {
        let std_dev = match activation {
            ActivationFunction::Sigmoid | ActivationFunction::Linear => {
                (2.0 / (input_size + output_size) as f32).sqrt()
            }
            ActivationFunction::ReLU => (2.0 / input_size as f32).sqrt(),
        };
        let normal = Normal::new(0.0, std_dev).unwrap();
        let weights_array =
            Array2::from_shape_fn((output_size, input_size), |_| normal.sample(rng));
        let biases_array = Array1::zeros(output_size);

        let weights = weights_array.outer_iter().map(|row| row.to_vec()).collect();
        let biases = biases_array.to_vec();

        Layer {
            weights,
            biases,
            activation,
        }
    }

    pub fn weights_array(&self) -> Array2<f32> {
        Array2::from_shape_vec(
            (self.biases.len(), self.weights[0].len()),
            self.weights.iter().flatten().cloned().collect(),
        )
        .unwrap()
    }

    pub fn biases_array(&self) -> Array1<f32> {
        Array1::from(self.biases.clone())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NeuralNetwork {
    pub layers: Vec<Layer>,
}

impl NeuralNetwork {
    pub fn new(
        layer_sizes: &[usize],
        activations: &[ActivationFunction],
        rng: &mut StdRng,
    ) -> Result<Self> {
        if layer_sizes.len() < 2 {
            bail!("Network must have at least input and output layers.");
        }
        if layer_sizes.len() - 1 != activations.len() {
            bail!("Number of activations must be one less than number of layers.");
        }

        let layers = layer_sizes
            .windows(2)
            .zip(activations.iter())
            .map(|(sizes, &activation)| Layer::new(sizes[0], sizes[1], activation, rng))
            .collect();

        Ok(NeuralNetwork { layers })
    }

    pub fn feedforward(&self, input: &Array1<f32>) -> Array1<f32> {
        let mut activations = input.clone();

        for layer in &self.layers {
            let weights = layer.weights_array();
            let biases = layer.biases_array();
            let z = weights.dot(&activations) + &biases;
            activations = layer.activation.activate(&z);
        }

        activations
    }

    pub fn save_to_file(&self, path: &PathBuf) -> Result<()> {
        let serialized = bincode::serialize(self).unwrap();
        std::fs::write(path, serialized).unwrap();
        Ok(())
    }

    pub fn load_from_file(path: &PathBuf) -> Result<Self> {
        let bytes = std::fs::read(path).unwrap();
        let network: NeuralNetwork = bincode::deserialize(&bytes).unwrap();
        Ok(network)
    }
}

#[derive(Clone)]
pub struct DataPoint {
    pub inputs: Array1<f32>,
    pub targets: Array1<f32>,
}

pub struct Trainer<'a> {
    pub network: &'a mut NeuralNetwork,
    pub learning_rate: f32,
    pub momentum: f32,
    pub weight_velocities: Vec<Array2<f32>>,
    pub bias_velocities: Vec<Array1<f32>>,
}

impl<'a> Trainer<'a> {
    pub fn new(network: &'a mut NeuralNetwork, learning_rate: f32, momentum: f32) -> Self {
        let weight_velocities = network
            .layers
            .iter()
            .map(|layer| Array2::zeros((layer.biases.len(), layer.weights[0].len())))
            .collect();

        let bias_velocities = network
            .layers
            .iter()
            .map(|layer| Array1::zeros(layer.biases.len()))
            .collect();

        Trainer {
            network,
            learning_rate,
            momentum,
            weight_velocities,
            bias_velocities,
        }
    }

    pub fn train(&mut self, data: &[DataPoint], epochs: usize) {
        for epoch in 0..epochs {
            let (total_weight_grads, total_bias_grads, total_error) = data
                .par_iter()
                .map(|point| self.compute_gradients(point))
                .reduce(
                    || {
                        let mut total_weight_grads = Vec::new();
                        let mut total_bias_grads = Vec::new();
                        for layer in &self.network.layers {
                            total_weight_grads
                                .push(Array2::zeros((layer.biases.len(), layer.weights[0].len())));
                            total_bias_grads.push(Array1::zeros(layer.biases.len()));
                        }
                        (total_weight_grads, total_bias_grads, 0.0f32)
                    },
                    |(mut w1, mut b1, e1), (w2, b2, e2)| {
                        for i in 0..w1.len() {
                            w1[i] += &w2[i];
                            b1[i] += &b2[i];
                        }
                        (w1, b1, e1 + e2)
                    },
                );

            let data_len = data.len() as f32;

            for (i, layer) in self.network.layers.iter_mut().enumerate() {
                let grad_w = &total_weight_grads[i] * (self.learning_rate / data_len);
                let grad_b = &total_bias_grads[i] * (self.learning_rate / data_len);

                self.weight_velocities[i] = &self.weight_velocities[i] * self.momentum - &grad_w;
                self.bias_velocities[i] = &self.bias_velocities[i] * self.momentum - &grad_b;

                let weights_array = layer.weights_array() + &self.weight_velocities[i];
                let biases_array = layer.biases_array() + &self.bias_velocities[i];

                layer.weights = weights_array.outer_iter().map(|row| row.to_vec()).collect();
                layer.biases = biases_array.to_vec();
            }

            if epoch % 1 == 0 || epoch == epochs - 1 {
                println!("Epoch {}: Error = {}", epoch, total_error / data_len);
            }
        }
    }

    fn compute_gradients(
        &self,
        data_point: &DataPoint,
    ) -> (Vec<Array2<f32>>, Vec<Array1<f32>>, f32) {
        let mut activations = Vec::new();
        let mut zs = Vec::new();
        activations.push(data_point.inputs.clone());

        for layer in &self.network.layers {
            let weights = layer.weights_array();
            let biases = layer.biases_array();
            let z = weights.dot(activations.last().unwrap()) + &biases;
            zs.push(z.clone());
            let activation = layer.activation.activate(&z);
            activations.push(activation);
        }

        let output_activations = activations.last().unwrap();
        let error_signal = output_activations - &data_point.targets;

        let error = error_signal.mapv(|e| e * e).sum() / error_signal.len() as f32;

        let mut deltas = Vec::new();
        let delta = error_signal
            * self
                .network
                .layers
                .last()
                .unwrap()
                .activation
                .derivative(&zs.last().unwrap());

        deltas.push(delta);

        for l in (1..self.network.layers.len()).rev() {
            let layer = &self.network.layers[l];
            let delta_next = &deltas[0];
            let sp = self.network.layers[l - 1].activation.derivative(&zs[l - 1]);
            let weights = layer.weights_array();
            let delta = weights.t().dot(delta_next) * sp;
            deltas.insert(0, delta);
        }

        let mut nabla_b = Vec::new();
        let mut nabla_w = Vec::new();

        for (l, delta) in deltas.iter().enumerate() {
            nabla_b.push(delta.clone());
            let a_prev = &activations[l];
            let nabla_w_l = delta
                .view()
                .insert_axis(Axis(1))
                .dot(&a_prev.view().insert_axis(Axis(0)));
            nabla_w.push(nabla_w_l);
        }

        (nabla_w, nabla_b, error)
    }
}
