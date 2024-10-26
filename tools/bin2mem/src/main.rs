use std::io::Write;

fn main() {
    // usage: bin2mem input.bin output.mem

    let input = std::env::args().nth(1).expect("missing input file");
    let output = std::env::args().nth(2).expect("missing output file");

    let input = std::fs::read(input).expect("failed to read input file");

    let mut output = std::fs::File::create(output).expect("failed to create output file");

    writeln!(output, "@00000000").expect("failed to write to output file");
    for byte in input {
        write!(output, "{:02X}", byte).expect("failed to write to output file");
    }

    output.sync_all().expect("failed to write to output file");
}
