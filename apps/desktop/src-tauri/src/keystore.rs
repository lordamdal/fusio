use std::fs;
use std::path::PathBuf;

fn keypair_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir().ok_or("Cannot determine data directory")?;
    let fusio_dir = data_dir.join("fusio");
    fs::create_dir_all(&fusio_dir)
        .map_err(|e| format!("Cannot create fusio data dir: {}", e))?;
    Ok(fusio_dir.join("keypair.hex"))
}

#[tauri::command]
pub fn store_keypair(private_key_hex: String) -> Result<(), String> {
    let path = keypair_path()?;
    fs::write(&path, &private_key_hex)
        .map_err(|e| format!("Failed to write keypair: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn load_keypair() -> Result<Option<String>, String> {
    let path = keypair_path()?;
    if path.exists() {
        let contents = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read keypair: {}", e))?;
        let trimmed = contents.trim().to_string();
        if trimmed.is_empty() {
            Ok(None)
        } else {
            Ok(Some(trimmed))
        }
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn has_keypair() -> bool {
    keypair_path()
        .map(|p| p.exists())
        .unwrap_or(false)
}
