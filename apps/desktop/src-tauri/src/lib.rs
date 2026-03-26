mod worker;
mod keystore;

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            worker::start_worker,
            worker::stop_worker,
            worker::get_worker_status,
            worker::get_worker_logs,
            keystore::store_keypair,
            keystore::load_keypair,
            keystore::has_keypair,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fusio");
}
