// Launch the bundled Python engine without a shell or a console window.
#![cfg(windows)]
use std::{env, process::{Command, Stdio}};
use std::os::windows::process::CommandExt;

fn run() -> Result<i32, Box<dyn std::error::Error>> {
    let executable = env::current_exe()?.canonicalize()?;
    let vision = executable.parent().ok_or("missing vision directory")?;
    let root = vision.parent().ok_or("missing application directory")?;
    let python = root.join("runtime").join("python").join("python.exe");
    let modules = vision.join("site-packages");
    let status = Command::new(python)
        .arg("-m").arg("design_acceptance_vision.rpc")
        .args(env::args_os().skip(1))
        .current_dir(root)
        .env("PYTHONPATH", modules)
        .env("PYTHONNOUSERSITE", "1")
        .env("PYTHONDONTWRITEBYTECODE", "1")
        .env_remove("PYTHONHOME")
        .stdin(Stdio::inherit()).stdout(Stdio::inherit()).stderr(Stdio::inherit())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .status()?;
    Ok(status.code().unwrap_or(1))
}

fn main() { std::process::exit(run().unwrap_or(1)); }
