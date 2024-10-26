#![no_std]
#![no_main]

extern crate panic_halt;

use core::arch::asm;
use riscv_rt::entry;

fn delay(cycles: u32) {
    for _ in 0..cycles {
        unsafe {
            asm!("nop");
        }
    }
}

fn init_leds() {
    unsafe {
        *(0x10000008 as *mut u32) = 0xff;
    }
}

fn set_leds(mask: u32) {
    unsafe {
        *(0x10000004 as *mut u32) = mask;
    }
}

#[entry]
fn main() -> ! {
    init_leds();
    let mut mask = 0x40;
    loop {
        set_leds(mask);
        mask >>= 1;
        if mask == 0 {
            mask = 0x40;
        }
        delay(300000);
    }
}