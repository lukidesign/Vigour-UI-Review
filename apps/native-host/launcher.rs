// Tiny launcher: use only bundled Node, never the user's PATH or a shell.
// All stdout belongs to the length-prefixed Native Messaging protocol.
use std::{env, path::PathBuf, process::{Command, Stdio}};

fn run() -> Result<i32, Box<dyn std::error::Error>> {
    let executable = env::current_exe()?.canonicalize()?;
    let native = executable.parent().ok_or("missing native directory")?;
    let root = native.parent().ok_or("missing application directory")?;
    let node: PathBuf = root.join("runtime").join(if cfg!(windows) { "node.exe" } else { "node" });
    let mut command = Command::new(node);
    command.arg(native.join("host.mjs"));
    // Chrome passes its caller origin as the first argument. The JS host validates
    // it against the installation's exact extension ID before reading secrets.
    command.args(env::args_os().skip(1)).current_dir(root)
        .env_remove("NODE_OPTIONS").env_remove("NODE_PATH")
        .stdin(Stdio::inherit()).stdout(Stdio::inherit()).stderr(Stdio::null());
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    Ok(command.status()?.code().unwrap_or(1))
}

fn main() {
    std::process::exit(run().unwrap_or(1));
}
