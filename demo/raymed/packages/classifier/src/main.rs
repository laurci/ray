use std::path::PathBuf;

use dataset::{merge_and_shuffle_datasets, pick_test_data, read_dataset_csv, Class};
use rand::{rngs::StdRng, SeedableRng};
use ray_ml::{
    nd::Array1, ActivationFunction, DataPoint, NeuralNetwork, QuantizedNeuralNetwork, Trainer,
};
use ray_shared::result::Result;

mod dataset;

fn load_dataset(rng: &mut StdRng) -> Vec<(Vec<i8>, Class)> {
    let normal = read_dataset_csv("./dataset/normal.csv");
    let faint = read_dataset_csv("./dataset/faint.csv");
    let seizure = read_dataset_csv("./dataset/seizure.csv");
    let dataset = merge_and_shuffle_datasets(vec![normal, faint, seizure], rng);
    return dataset;
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        println!("Usage: cargo run -- [train|eval]");
        return Ok(());
    }

    match args[1].as_str() {
        "train" => train()?,
        "eval" => eval()?,
        _ => println!("Invalid argument. Use 'train' or 'eval'."),
    }

    Ok(())
}

fn train() -> Result<()> {
    let seed: u64 = 42;
    let mut rng = StdRng::seed_from_u64(seed);

    let mut training_data = load_dataset(&mut rng);
    let dataset_size = training_data.len();
    let _test_data = pick_test_data(&mut training_data, dataset_size / 10, &mut rng);

    let training_data: Vec<DataPoint> = training_data
        .iter()
        .map(|input| {
            let inputs = Array1::from_iter(input.0.iter().map(|&pixel| pixel as f32 / 127.0));

            let mut targets = Array1::zeros(3);
            targets[input.1.to_usize() as usize] = 1.0;

            DataPoint { inputs, targets }
        })
        .collect();

    let layer_sizes = [60, 30, 15, 3];
    let activations = [
        ActivationFunction::Sigmoid,
        ActivationFunction::Sigmoid,
        ActivationFunction::Sigmoid,
    ];

    let mut network = NeuralNetwork::new(&layer_sizes, &activations, &mut rng);

    let mut trainer = Trainer::new(&mut network, 0.2f32, 0.7f32);

    trainer.train(&training_data, 10_000);

    let fp_model_path = PathBuf::from("model_floating_point.bin");
    network.save_to_file(&fp_model_path)?;
    println!("Floating-point model saved to {:?}", fp_model_path);

    let quantized_network = network.quantize();

    let quant_model_path = PathBuf::from("model_quantized.bin");
    quantized_network.save_to_file(&quant_model_path)?;
    println!("Quantized model saved to {:?}", quant_model_path);

    let mut fine_trainer = Trainer::new(&mut network, 0.2f32, 0.8f32);
    fine_trainer.fine_tune(&training_data, 5_000);

    let fine_tuned_model_path = PathBuf::from("model_fine_tuned.bin");
    network.save_to_file(&fine_tuned_model_path)?;
    println!(
        "Fine-tuned floating-point model saved to {:?}",
        fine_tuned_model_path
    );

    let requantized_network = network.quantize();

    let requant_model_path = PathBuf::from("model_requantized.bin");
    requantized_network.save_to_file(&requant_model_path)?;

    Ok(())
}

fn eval() -> Result<()> {
    let seed: u64 = 100;
    let mut rng = StdRng::seed_from_u64(seed);

    let mut training_data = load_dataset(&mut rng);
    let dataset_size = training_data.len();
    let test_data = pick_test_data(&mut training_data, dataset_size / 10, &mut rng);

    let test_data: Vec<DataPoint> = test_data
        .iter()
        .map(|input| {
            let inputs = Array1::from_iter(input.0.iter().map(|&pixel| pixel as f32 / 127.0));

            let mut targets = Array1::zeros(3);
            targets[input.1.to_usize() as usize] = 1.0;

            DataPoint { inputs, targets }
        })
        .collect();

    let requant_model_path = PathBuf::from("model_requantized.bin");
    let requantized_network = QuantizedNeuralNetwork::load_from_file(&requant_model_path)?;

    let mut correct = 0;
    for point in &test_data {
        let quant_inputs = point
            .inputs
            .mapv(|x| (x * 127.0).round().clamp(-128.0, 127.0) as i8);

        let output = requantized_network.feedforward(&quant_inputs);
        let output_float = output.mapv(|x| x as f32 / 127.0);

        let prediction = output_float
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(idx, _)| idx)
            .unwrap();

        let target = point
            .targets
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(idx, _)| idx)
            .unwrap();

        if prediction == target {
            correct += 1;
        }
    }

    let accuracy = correct as f32 / test_data.len() as f32 * 100.0;
    println!("Quantized Network Test Accuracy: {:.2}%", accuracy);

    Ok(())
}
