mod worker;
mod keystore;
mod deps;
mod session_capture;

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            worker::ensure_services,
            worker::start_worker,
            worker::stop_worker,
            worker::get_worker_status,
            worker::get_worker_logs,
            keystore::store_keypair,
            keystore::load_keypair,
            keystore::has_keypair,
            deps::check_dependencies,
            deps::install_dependency,
            deps::setup_all,
            deps::open_docker_download,
            session_capture::open_login_window,
            session_capture::check_login_status,
            session_capture::close_login_window,
            session_capture::receive_session_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fusio");
}
