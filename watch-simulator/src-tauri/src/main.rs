// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State, Window};

struct TcpState {
    stream: Option<TcpStream>,
}

#[tauri::command]
fn get_profile() -> String {
    let args: Vec<String> = std::env::args().collect();
    for (i, arg) in args.iter().enumerate() {
        if arg == "--profile" && i + 1 < args.len() {
            return args[i + 1].clone();
        }
        if arg.contains("senior2") {
            return "senior2".to_string();
        }
        if arg.contains("senior1") {
            return "senior1".to_string();
        }
    }
    if let Ok(val) = std::env::var("WATCH_PROFILE") {
        if !val.is_empty() {
            return val;
        }
    }
    "senior1".to_string()
}

#[tauri::command]
fn set_window_title(title: String, window: Window) -> Result<(), String> {
    window.set_title(&title).map_err(|e| e.to_string())
}

#[tauri::command]
fn connect_tcp(
    ip: String,
    port: u16,
    state: State<'_, Arc<Mutex<TcpState>>>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let addr = format!("{}:{}", ip, port);
    match TcpStream::connect(&addr) {
        Ok(stream) => {
            // Clone stream for reading thread
            let mut read_stream = stream.try_clone().map_err(|e| e.to_string())?;
            
            // Save write stream in state
            let mut state_lock = state.lock().unwrap();
            state_lock.stream = Some(stream);

            // Spawn read thread
            thread::spawn(move || {
                let mut buffer = [0; 1024];
                loop {
                    match read_stream.read(&mut buffer) {
                        Ok(0) => {
                            // Connection closed
                            app_handle.emit("tcp-disconnected", ()).unwrap();
                            break;
                        }
                        Ok(n) => {
                            let data = String::from_utf8_lossy(&buffer[..n]).into_owned();
                            app_handle.emit("tcp-rx", data).unwrap();
                        }
                        Err(_) => {
                            app_handle.emit("tcp-error", "Connection error").unwrap();
                            break;
                        }
                    }
                }
            });

            Ok(format!("Connected to {}", addr))
        }
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn send_tcp(
    data: String,
    state: State<'_, Arc<Mutex<TcpState>>>,
) -> Result<(), String> {
    let mut state_lock = state.lock().unwrap();
    if let Some(stream) = &mut state_lock.stream {
        stream.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Not connected".to_string())
    }
}

fn main() {
    let tcp_state = Arc::new(Mutex::new(TcpState { stream: None }));

    tauri::Builder::default()
        .manage(tcp_state)
        .invoke_handler(tauri::generate_handler![connect_tcp, send_tcp, get_profile, set_window_title])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
