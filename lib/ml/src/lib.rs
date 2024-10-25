pub use ndarray as nd;

use rand::rngs::StdRng;
use rand_distr::{Distribution, Normal};
use ray_shared::result::{bail, Result};

use nd::{Array1, Array2, Axis};

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ActivationFunction {
    Sigmoid,
}

impl ActivationFunction {
    pub fn activate(&self, x: &Array1<f32>) -> Array1<f32> {
        match self {
            ActivationFunction::Sigmoid => x.mapv(|x| 1.0 / (1.0 + (-x).exp())),
        }
    }
}

#[derive(Clone, Debug)]
pub struct Layer {
    pub weights: Array2<f32>,
    pub biases: Array1<f32>,
    pub activation: ActivationFunction,
}

impl Layer {
    pub fn new(
        input_size: usize,
        output_size: usize,
        activation: ActivationFunction,
        rng: &mut StdRng,
    ) -> Self {
        let std_dev = ((2.0) / (input_size + output_size) as f32).sqrt();
        let normal = Normal::new(0.0, std_dev).unwrap();
        let weights = Array2::from_shape_fn((output_size, input_size), |_| normal.sample(rng));
        let biases = Array1::zeros(output_size);

        Layer {
            weights,
            biases,
            activation,
        }
    }
}

#[derive(Clone, Debug)]
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
            let z = layer.weights.dot(&activations) + &layer.biases;
            activations = layer.activation.activate(&z);
        }

        activations
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
}

impl<'a> Trainer<'a> {
    pub fn new(network: &'a mut NeuralNetwork, learning_rate: f32) -> Self {
        Trainer {
            network,
            learning_rate,
        }
    }

    pub fn train(&mut self, data: &[DataPoint], epochs: usize) {
        for epoch in 0..epochs {
            let mut total_weight_grads = Vec::new();
            let mut total_bias_grads = Vec::new();
            for layer in &self.network.layers {
                total_weight_grads.push(Array2::zeros(layer.weights.raw_dim()));
                total_bias_grads.push(Array1::zeros(layer.biases.len()));
            }
            let mut total_error = 0.0f32;

            for point in data.iter() {
                let (nabla_w, nabla_b, error) = self.compute_gradients(point);

                for i in 0..self.network.layers.len() {
                    total_weight_grads[i] += &nabla_w[i];
                    total_bias_grads[i] += &nabla_b[i];
                }
                total_error += error;
            }

            let data_len = data.len() as f32;

            for (i, layer) in self.network.layers.iter_mut().enumerate() {
                let grad_w = &total_weight_grads[i] * (self.learning_rate / data_len);
                let grad_b = &total_bias_grads[i] * (self.learning_rate / data_len);

                layer.weights -= &grad_w;
                layer.biases -= &grad_b;
            }

            if epoch % 1000 == 0 || epoch == epochs - 1 {
                println!("Epoch {}: Error = {}", epoch, total_error / data_len);
            }
        }
    }

    fn compute_gradients(
        &self,
        data_point: &DataPoint,
    ) -> (Vec<Array2<f32>>, Vec<Array1<f32>>, f32) {
        let mut activations = Vec::new();
        activations.push(data_point.inputs.clone());

        let mut zs = Vec::new();
        for layer in &self.network.layers {
            let z = layer.weights.dot(activations.last().unwrap()) + &layer.biases;
            zs.push(z.clone());
            let activation = layer.activation.activate(&z);
            activations.push(activation);
        }

        let output_activations = activations.last().unwrap();
        let error_signal = output_activations - &data_point.targets;

        let error = error_signal.mapv(|e| e * e).sum() / error_signal.len() as f32;

        let mut deltas = Vec::new();
        let output_activation = output_activations;
        let delta = error_signal * output_activation * (1.0 - output_activation);
        deltas.push(delta);

        for l in (1..self.network.layers.len()).rev() {
            let layer = &self.network.layers[l];
            let delta_next = &deltas[0];
            let activation = &activations[l];
            let delta = layer.weights.t().dot(delta_next) * activation * (1.0 - activation);
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
