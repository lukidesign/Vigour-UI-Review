// Current-user Windows Credential Manager bridge. Secrets travel only through
// redirected stdin/stdout, never command-line arguments or process logs.
#![cfg(windows)]
use std::{env, ffi::c_void, io::{Read, Write}, ptr, slice};

#[repr(C)]
struct FileTime { low: u32, high: u32 }
#[repr(C)]
struct CredentialW {
    flags: u32, kind: u32, target_name: *mut u16, comment: *mut u16,
    last_written: FileTime, blob_size: u32, blob: *mut u8, persist: u32,
    attribute_count: u32, attributes: *mut c_void, target_alias: *mut u16,
    user_name: *mut u16,
}
#[link(name = "Advapi32")]
unsafe extern "system" {
    fn CredWriteW(credential: *const CredentialW, flags: u32) -> i32;
    fn CredReadW(target: *const u16, kind: u32, flags: u32, credential: *mut *mut CredentialW) -> i32;
    fn CredDeleteW(target: *const u16, kind: u32, flags: u32) -> i32;
    fn CredFree(buffer: *mut c_void);
}
#[link(name = "Kernel32")]
unsafe extern "system" { fn GetLastError() -> u32; }

fn wide(text: &str) -> Vec<u16> { text.encode_utf16().chain(std::iter::once(0)).collect() }
fn run() -> Result<(), &'static str> {
    let mut args = env::args().skip(1);
    let action = args.next().ok_or("ACTION_REQUIRED")?;
    let account = args.next().ok_or("ACCOUNT_REQUIRED")?;
    if args.next().is_some() || !matches!(account.as_str(), "figma-pat" | "ai-openai" | "ai-gemini" | "ai-kimi" | "ai-deepseek" | "self-test") {
        return Err("INVALID_ACCOUNT");
    }
    let target = wide(&format!("com.vigour-ui-review.local/{account}"));
    match action.as_str() {
        "save" => {
            let mut secret = Vec::new();
            std::io::stdin().take(2561).read_to_end(&mut secret).map_err(|_| "READ_FAILED")?;
            if secret.is_empty() || secret.len() > 2560 || std::str::from_utf8(&secret).is_err() { return Err("INVALID_SECRET"); }
            let credential = CredentialW {
                flags: 0, kind: 1, target_name: target.as_ptr() as *mut u16, comment: ptr::null_mut(),
                last_written: FileTime { low: 0, high: 0 }, blob_size: secret.len() as u32,
                blob: secret.as_mut_ptr(), persist: 2, attribute_count: 0,
                attributes: ptr::null_mut(), target_alias: ptr::null_mut(), user_name: ptr::null_mut(),
            };
            let ok = unsafe { CredWriteW(&credential, 0) };
            secret.fill(0);
            if ok == 0 { return Err("CREDENTIAL_WRITE_FAILED"); }
        }
        "read" => {
            let mut raw: *mut CredentialW = ptr::null_mut();
            if unsafe { CredReadW(target.as_ptr(), 1, 0, &mut raw) } == 0 {
                if unsafe { GetLastError() } == 1168 { return Ok(()); } // ERROR_NOT_FOUND
                return Err("CREDENTIAL_READ_FAILED");
            }
            if raw.is_null() { return Err("CREDENTIAL_READ_FAILED"); }
            let output = unsafe {
                let credential = &*raw;
                if credential.blob.is_null() || credential.blob_size > 2560 { Err("CREDENTIAL_READ_FAILED") }
                else { std::io::stdout().write_all(slice::from_raw_parts(credential.blob, credential.blob_size as usize)).map_err(|_| "CREDENTIAL_READ_FAILED") }
            };
            unsafe { CredFree(raw as *mut c_void) };
            output?;
        }
        "remove" => {
            if unsafe { CredDeleteW(target.as_ptr(), 1, 0) } == 0 && unsafe { GetLastError() } != 1168 {
                return Err("CREDENTIAL_DELETE_FAILED");
            }
        }
        _ => return Err("INVALID_ACTION"),
    }
    Ok(())
}
fn main() { if let Err(error) = run() { eprintln!("{error}"); std::process::exit(1); } }
