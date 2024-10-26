mod dataset;

use std::path::PathBuf;

use dataset::read_images_from_csv;
use rand::{rngs::StdRng, SeedableRng};
use ray_ml::{
    nd::Array1, ActivationFunction, DataPoint, NeuralNetwork, QuantizedNeuralNetwork, Trainer,
};
use ray_shared::result::Result;

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

    let layer_sizes = [28 * 28, 128, 64, 10];
    let activations = [
        ActivationFunction::Sigmoid,
        ActivationFunction::Sigmoid,
        ActivationFunction::Sigmoid,
    ];

    let mut network = NeuralNetwork::new(&layer_sizes, &activations, &mut rng);

    let train_data_path = PathBuf::from("./dataset/mnist_train.csv");
    let training_images = read_images_from_csv::<28, 28>(&train_data_path);

    let training_data: Vec<DataPoint> = training_images
        .iter()
        .map(|image| {
            let inputs = Array1::from_iter(
                image
                    .data
                    .iter()
                    .flatten()
                    .map(|&pixel| pixel as f32 / 255.0),
            );

            let mut targets = Array1::zeros(10);
            targets[image.label as usize] = 1.0;

            DataPoint { inputs, targets }
        })
        .collect();

    let mut trainer = Trainer::new(&mut network, 0.2f32, 0.7f32);

    trainer.train(&training_data, 10_000);

    let fp_model_path = PathBuf::from("model_floating_point.bin");
    network.save_to_file(&fp_model_path)?;
    println!("Floating-point model saved to {:?}", fp_model_path);

    let quantized_network = network.quantize();

    let quant_model_path = PathBuf::from("model_quantized.bin");
    quantized_network.save_to_file(&quant_model_path)?;
    println!("Quantized model saved to {:?}", quant_model_path);

    let mut fine_trainer = Trainer::new(&mut network, 0.1f32, 0.8f32);
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
    let requant_model_path = PathBuf::from("model_requantized.bin");
    let requantized_network = QuantizedNeuralNetwork::load_from_file(&requant_model_path)?;

    let test_data_path = PathBuf::from("./dataset/mnist_test.csv");
    let test_images = read_images_from_csv::<28, 28>(&test_data_path);

    let test_data: Vec<DataPoint> = test_images
        .iter()
        .map(|image| {
            let inputs = Array1::from_iter(
                image
                    .data
                    .iter()
                    .flatten()
                    .map(|&pixel| pixel as f32 / 255.0),
            );

            let mut targets = Array1::zeros(10);
            targets[image.label as usize] = 1.0;

            DataPoint { inputs, targets }
        })
        .collect();

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
