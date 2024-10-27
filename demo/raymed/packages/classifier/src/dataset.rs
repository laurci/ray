use rand::{rngs::StdRng, seq::SliceRandom, RngCore};

#[derive(Debug, Clone, PartialEq)]
pub enum Class {
    Normal,
    Faint,
    Seizure,
}

impl Class {
    pub fn from_i8(i: i8) -> Class {
        match i {
            0 => Class::Normal,
            1 => Class::Faint,
            2 => Class::Seizure,
            _ => panic!("Invalid class"),
        }
    }

    pub fn to_usize(&self) -> usize {
        match self {
            Class::Normal => 0,
            Class::Faint => 1,
            Class::Seizure => 2,
        }
    }
}

pub fn read_dataset_csv(path: &str) -> Vec<(Vec<i8>, Class)> {
    let mut output = Vec::new();

    let mut reader = csv::Reader::from_path(path).unwrap();
    for result in reader.records() {
        let record = result.unwrap();
        let mut iter = record.iter();

        // 60 values followed by a class
        let mut features = Vec::new();
        for _ in 0..60 {
            features.push(iter.next().unwrap().parse().unwrap());
        }
        let class = Class::from_i8(iter.next().unwrap().parse().unwrap());

        output.push((features, class));
    }

    output
}

pub fn merge_and_shuffle_datasets(
    datasets: Vec<Vec<(Vec<i8>, Class)>>,
    rng: &mut StdRng,
) -> Vec<(Vec<i8>, Class)> {
    let mut output = Vec::new();

    for dataset in datasets {
        output.extend(dataset);
    }

    output.shuffle(rng);

    output
}

pub fn pick_test_data(
    dataset: &mut Vec<(Vec<i8>, Class)>,
    test_size: usize,
    rng: &mut StdRng,
) -> Vec<(Vec<i8>, Class)> {
    let mut test_data = Vec::new();

    for _ in 0..test_size {
        let index = rng.next_u64() as usize % dataset.len();
        test_data.push(dataset.remove(index));
    }

    test_data
}
