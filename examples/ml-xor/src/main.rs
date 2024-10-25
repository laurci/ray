use rand::{rngs::StdRng, SeedableRng};
use ray_ml::{nd::Array1, ActivationFunction, DataPoint, NeuralNetwork, Trainer};
use ray_shared::result::Result;

fn main() -> Result<()> {
    let seed: u64 = 42;
    let mut rng = StdRng::seed_from_u64(seed);

    let layer_sizes = [2, 4, 1];
    let activations = [ActivationFunction::Sigmoid, ActivationFunction::Sigmoid];

    let mut network = NeuralNetwork::new(&layer_sizes, &activations, &mut rng)?;

    let training_data = vec![
        DataPoint {
            inputs: Array1::from_vec(vec![0.0, 0.0]),
            targets: Array1::from_vec(vec![0.0]),
        },
        DataPoint {
            inputs: Array1::from_vec(vec![0.0, 1.0]),
            targets: Array1::from_vec(vec![1.0]),
        },
        DataPoint {
            inputs: Array1::from_vec(vec![1.0, 0.0]),
            targets: Array1::from_vec(vec![1.0]),
        },
        DataPoint {
            inputs: Array1::from_vec(vec![1.0, 1.0]),
            targets: Array1::from_vec(vec![0.0]),
        },
    ];

    let mut trainer = Trainer::new(&mut network, 0.1f32);
    trainer.train(&training_data, 50_000); // too many, but ok.

    println!("test");
    for point in &training_data {
        let output = network.feedforward(&point.inputs);
        println!(
            "Input: {:?}, Output: {:.3}, Target: {:.1}",
            point.inputs, output[0], point.targets[0]
        );
    }

    Ok(())
}
