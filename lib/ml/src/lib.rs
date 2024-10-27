pub use ndarray as nd;

use nd::{Array1, Array2, Axis};
use rand::rngs::StdRng;
use rand_distr::{Distribution, Normal};
use ray_shared::result::{bail, Result};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::PathBuf;

#[derive(Clone, Copy, PartialEq, Serialize, Deserialize, Debug)]
pub enum ActivationFunction {
    ReLU,
    Sigmoid,
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
                let a = x.mapv(|x| 1.0 / (1.0 + (-x).exp()));
                &a * &(1.0 - &a)
            }
            ActivationFunction::ReLU => x.mapv(|x| if x > 0.0 { 1.0 } else { 0.0 }),
            ActivationFunction::Linear => Array1::ones(x.len()),
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
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
        let std_dev = match activation {
            ActivationFunction::Sigmoid | ActivationFunction::Linear => {
                ((2.0) / (input_size + output_size) as f32).sqrt()
            }
            ActivationFunction::ReLU => (2.0 / input_size as f32).sqrt(),
        };
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

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct NeuralNetwork {
    pub layers: Vec<Layer>,
}

impl NeuralNetwork {
    pub fn new(
        layer_sizes: &[usize],
        activations: &[ActivationFunction],
        rng: &mut StdRng,
    ) -> Self {
        assert!(
            layer_sizes.len() >= 2,
            "Network must have at least input and output layers."
        );
        assert_eq!(
            layer_sizes.len() - 1,
            activations.len(),
            "Number of activations must be one less than number of layers."
        );

        let layers = layer_sizes
            .windows(2)
            .zip(activations.iter())
            .map(|(sizes, &activation)| Layer::new(sizes[0], sizes[1], activation, rng))
            .collect();

        NeuralNetwork { layers }
    }

    pub fn feedforward(&self, input: &Array1<f32>) -> Array1<f32> {
        let mut activations = input.clone();

        for layer in &self.layers {
            let z = layer.weights.dot(&activations) + &layer.biases;
            activations = layer.activation.activate(&z);
        }

        activations
    }

    pub fn save_to_file(&self, path: &PathBuf) -> Result<()> {
        let file = File::create(path)?;
        let writer = BufWriter::new(file);
        bincode::serialize_into(writer, self)?;
        Ok(())
    }

    pub fn load_from_file(path: &PathBuf) -> Result<Self> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);

        let net = bincode::deserialize_from(reader)?;
        Ok(net)
    }

    pub fn quantize(&self) -> QuantizedNeuralNetwork {
        let mut quant_layers = Vec::new();

        for (layer_idx, layer) in self.layers.iter().enumerate() {
            // Compute weight scale based on maximum absolute weight
            let max_weight = layer.weights.mapv(f32::abs).fold(0.0f32, |a, b| a.max(*b));

            // Enforce a minimum weight_scale to prevent quantized weights from being all zeros
            let min_weight_scale = 1e-6;
            let weight_scale = if max_weight == 0.0 {
                1.0
            } else {
                let scale = max_weight / 127.0;
                if scale < min_weight_scale {
                    println!(
                        "Layer {}: weight_scale {:.6} is below min_threshold {:.6}. Setting to min_scale.",
                        layer_idx, scale, min_weight_scale
                    );
                    min_weight_scale
                } else {
                    scale
                }
            };

            let quant_weights = layer
                .weights
                .mapv(|weight| ((weight / weight_scale).round().clamp(-128.0, 127.0)) as i8);

            let bias_scale = weight_scale;

            let quant_biases = layer.biases.mapv(|bias| {
                let scaled_bias = bias / bias_scale;
                if scaled_bias.is_finite() {
                    scaled_bias.round() as i32
                } else if bias > 0.0 {
                    i32::MAX
                } else {
                    i32::MIN
                }
            });

            quant_layers.push(QuantizedLayer {
                weights: quant_weights,
                biases: quant_biases,
                activation: layer.activation,
                weight_scale,
                bias_scale,
            });
        }

        QuantizedNeuralNetwork {
            layers: quant_layers,
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct QuantizedLayer {
    pub weights: Array2<i8>,
    pub biases: Array1<i32>,
    pub activation: ActivationFunction,
    pub weight_scale: f32,
    pub bias_scale: f32,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct QuantizedNeuralNetwork {
    pub layers: Vec<QuantizedLayer>,
}

#[derive(Clone, Serialize, Debug)]
pub struct RaySocQuantizedFormat {}

impl QuantizedNeuralNetwork {
    pub fn feedforward(&self, input: &Array1<i8>) -> Array1<i8> {
        let mut activations = input.clone();

        for layer in &self.layers {
            let z = layer
                .weights
                .mapv(|w| w as i32)
                .dot(&activations.mapv(|a| a as i32))
                + &layer.biases;

            activations = match layer.activation {
                ActivationFunction::Sigmoid => z.mapv(|x| {
                    let x = (x >> 7).clamp(-8, 8);
                    let index = (x + 8) as usize;
                    SIGMOID_INT_TABLE[index]
                }),
                ActivationFunction::ReLU => z.mapv(|x| ((x.max(0).min(127)) as i8)),
                ActivationFunction::Linear => z.mapv(|x| ((x.clamp(-128, 127)) as i8)),
            };
        }

        activations
    }

    pub fn save_to_file(&self, path: &PathBuf) -> Result<()> {
        let file = File::create(path)?;
        let writer = BufWriter::new(file);
        bincode::serialize_into(writer, self)?;
        Ok(())
    }

    pub fn export_raysoc_network(&self, path: &PathBuf) -> Result<()> {
        let mut layers = Vec::new();

        if let Some(first_layer) = self.layers.first() {
            let input_size = first_layer.weights.shape()[1];
            layers.push(input_size);
        } else {
            bail!("The neural network has no layers.");
        }

        for layer in &self.layers {
            let output_size = layer.weights.shape()[0];
            layers.push(output_size);
        }

        let mut weights = Vec::new();
        let mut biases = Vec::new();

        for layer in &self.layers {
            let w = layer.weights.map(|&x| x as i32);
            let weight_rows = w.shape()[0];
            let weight_cols = w.shape()[1];
            let mut weight_matrix = Vec::with_capacity(weight_rows);

            for row in w.outer_iter() {
                weight_matrix.push(row.to_vec());
            }
            weights.push(weight_matrix);

            biases.push(layer.biases.to_vec());
        }

        #[derive(Serialize)]
        struct RaySocNetworkData {
            layers: Vec<usize>,
            weights: Vec<Vec<Vec<i32>>>,
            biases: Vec<Vec<i32>>,
        }

        let network_data = RaySocNetworkData {
            layers,
            weights,
            biases,
        };

        let json = serde_json::to_string_pretty(&network_data)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    pub fn load_from_file(path: &PathBuf) -> Result<Self> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);

        let net = bincode::deserialize_from(reader)?;
        Ok(net)
    }
}

const SIGMOID_INT_TABLE: [i8; 17] = [
    0, 4, 8, 15, 26, 41, 60, 81, 103, 122, 127, 127, 127, 127, 127, 127, 127,
];

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
            .map(|layer| Array2::zeros(layer.weights.raw_dim()))
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
                        (
                            vec![Array2::zeros((0, 0)); self.network.layers.len()],
                            vec![Array1::zeros(0); self.network.layers.len()],
                            0.0f32,
                        )
                    },
                    |(mut w1, mut b1, e1), (w2, b2, e2)| {
                        for i in 0..w1.len() {
                            if w1[i].is_empty() {
                                w1[i] = w2[i].clone();
                                b1[i] = b2[i].clone();
                            } else {
                                w1[i] += &w2[i];
                                b1[i] += &b2[i];
                            }
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

                layer.weights += &self.weight_velocities[i];
                layer.biases += &self.bias_velocities[i];
            }

            if epoch % 5 == 0 || epoch == epochs - 1 {
                println!("Epoch {}: Error = {}", epoch, total_error / data_len);
            }
        }
    }

    pub fn fine_tune(&mut self, data: &[DataPoint], epochs: usize) {
        for epoch in 0..epochs {
            let quant_network = self.network.quantize();

            let (total_weight_grads, total_bias_grads, total_error) = data
                .par_iter()
                .map(|point| self.compute_gradients_quantized(point, &quant_network))
                .reduce(
                    || {
                        (
                            vec![Array2::zeros((0, 0)); self.network.layers.len()],
                            vec![Array1::zeros(0); self.network.layers.len()],
                            0.0f32,
                        )
                    },
                    |(mut w1, mut b1, e1), (w2, b2, e2)| {
                        for i in 0..w1.len() {
                            if w1[i].is_empty() {
                                w1[i] = w2[i].clone();
                                b1[i] = b2[i].clone();
                            } else {
                                w1[i] += &w2[i];
                                b1[i] += &b2[i];
                            }
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

                layer.weights += &self.weight_velocities[i];
                layer.biases += &self.bias_velocities[i];
            }

            if epoch % 5 == 0 || epoch == epochs - 1 {
                println!(
                    "Fine-Tuning Epoch {}: Error = {}",
                    epoch,
                    total_error / data_len
                );
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
            let z = layer.weights.dot(activations.last().unwrap()) + &layer.biases;
            zs.push(z.clone());
            activations.push(layer.activation.activate(&z));
        }

        let output_activations = activations.last().unwrap();
        let delta = output_activations - &data_point.targets;

        let error = delta.mapv(|e| e * e).sum() / delta.len() as f32;

        let mut nabla_b = Vec::new();
        let mut nabla_w = Vec::new();

        let mut delta = delta
            * self
                .network
                .layers
                .last()
                .unwrap()
                .activation
                .derivative(zs.last().unwrap());

        for l in (0..self.network.layers.len()).rev() {
            let layer = &self.network.layers[l];
            nabla_b.insert(0, delta.clone());
            let a_prev = &activations[l];
            let nabla_w_l = delta
                .view()
                .insert_axis(Axis(1))
                .dot(&a_prev.view().insert_axis(Axis(0)));
            nabla_w.insert(0, nabla_w_l);

            if l > 0 {
                let z = &zs[l - 1];
                let sp = self.network.layers[l - 1].activation.derivative(z);
                delta = layer.weights.t().dot(&delta) * sp;
            }
        }

        (nabla_w, nabla_b, error)
    }

    fn compute_gradients_quantized(
        &self,
        data_point: &DataPoint,
        quant_network: &QuantizedNeuralNetwork,
    ) -> (Vec<Array2<f32>>, Vec<Array1<f32>>, f32) {
        let quant_inputs = data_point
            .inputs
            .mapv(|x| (x * 127.0).round().clamp(-128.0, 127.0) as i8);

        let quant_outputs = quant_network.feedforward(&quant_inputs);

        let output_float = quant_outputs.mapv(|x| (x as f32) / 127.0);

        let delta = &output_float - &data_point.targets;
        let error = delta.mapv(|e| e * e).sum() / delta.len() as f32;

        let mut activations = Vec::new();
        let mut zs = Vec::new();

        activations.push(data_point.inputs.clone());

        for layer in &self.network.layers {
            let z = layer.weights.dot(activations.last().unwrap()) + &layer.biases;
            zs.push(z.clone());
            activations.push(layer.activation.activate(&z));
        }

        let mut delta_fp = &output_float - &data_point.targets;

        let mut nabla_b = Vec::new();
        let mut nabla_w = Vec::new();

        delta_fp = delta_fp
            * self
                .network
                .layers
                .last()
                .unwrap()
                .activation
                .derivative(zs.last().unwrap());

        for l in (0..self.network.layers.len()).rev() {
            let layer = &self.network.layers[l];
            nabla_b.insert(0, delta_fp.clone());
            let a_prev = &activations[l];
            let nabla_w_l = delta_fp
                .view()
                .insert_axis(Axis(1))
                .dot(&a_prev.view().insert_axis(Axis(0)));
            nabla_w.insert(0, nabla_w_l);

            if l > 0 {
                let z = &zs[l - 1];
                let sp = self.network.layers[l - 1].activation.derivative(z);
                delta_fp = layer.weights.t().dot(&delta_fp) * sp;
            }
        }

        (nabla_w, nabla_b, error)
    }
}
