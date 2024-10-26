use std::path::PathBuf;

pub struct LabeledImage<const W: usize, const H: usize> {
    pub data: [[u8; W]; H],
    pub label: u8,
}

impl<const W: usize, const H: usize> LabeledImage<W, H> {
    fn new(label: u8, data: [[u8; W]; H]) -> LabeledImage<W, H> {
        LabeledImage { label, data }
    }

    pub fn label(&self) -> u8 {
        self.label
    }

    pub fn width(&self) -> usize {
        W
    }

    pub fn height(&self) -> usize {
        H
    }

    pub fn write_to_disk(&self, path: &PathBuf) {
        let image = image::ImageBuffer::from_fn(W as u32, H as u32, |x, y| {
            let pixel = self.data[y as usize][x as usize];
            image::Rgb([pixel, pixel, pixel])
        });
        image.save(path).unwrap();
    }
}

pub fn read_images_from_csv<const W: usize, const H: usize>(
    path: &PathBuf,
) -> Vec<LabeledImage<W, H>> {
    let mut images = Vec::new();
    let mut reader = csv::Reader::from_path(path).unwrap();
    for result in reader.records() {
        let record = result.unwrap();
        let mut iter = record.iter();
        let label = iter.next().unwrap().parse().unwrap();
        let mut image = [[0; W]; H];
        for (i, pixel) in iter.enumerate() {
            image[i / H][i % W] = pixel.parse().unwrap();
        }
        images.push(LabeledImage::new(label, image));
    }
    images
}
