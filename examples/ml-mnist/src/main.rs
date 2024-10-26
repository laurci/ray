mod dataset;

use std::path::PathBuf;

use rand::{rngs::StdRng, SeedableRng};
use ray_ml::{nd::Array1, ActivationFunction, DataPoint, NeuralNetwork, Trainer};
use ray_shared::result::Result;

fn main() -> Result<()> {
    use std::time::Instant;

    let seed: u64 = 42;
    let mut rng = StdRng::seed_from_u64(seed);

    let layer_sizes = [28 * 28, 128, 64, 10];
    let activations = [
        ActivationFunction::ReLU,
        ActivationFunction::ReLU,
        ActivationFunction::Linear,
    ];

    let mut network = NeuralNetwork::new(&layer_sizes, &activations, &mut rng)?;

    let train_data_path = PathBuf::from("./dataset/mnist_train.csv");
    let test_data_path = PathBuf::from("./dataset/mnist_test.csv");

    let training_images = dataset::read_images_from_csv::<28, 28>(&train_data_path);
    let test_images = dataset::read_images_from_csv::<28, 28>(&test_data_path);

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

    let mut trainer = Trainer::new(&mut network, 0.2f32, 0.7f32);

    let epochs = 1_000;
    let start_time = Instant::now();
    trainer.train(&training_data, epochs);
    let duration = start_time.elapsed();
    println!("Training completed in {:?}", duration);

    let mut correct = 0;
    for point in &test_data {
        let output = network.feedforward(&point.inputs);
        let prediction = output
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
    println!("Test Accuracy: {:.2}%", accuracy);

    Ok(())
}
