use serde::Serialize;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[derive(Serialize, Clone)]
pub struct DepState {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub install_hint: String,
}

#[derive(Serialize, Clone)]
pub struct DependencyStatus {
    pub node: DepState,
    pub nats: DepState,
    pub docker: DepState,
    pub docker_image: DepState,
    pub all_ready: bool,
}

/// Find a binary in bundled resources first, then common system paths.
fn find_dep_binary(name: &str) -> Option<PathBuf> {
    // 1. Bundled inside .app bundle: Fusio.app/Contents/Resources/bin/<name>
    if let Ok(exe) = std::env::current_exe() {
        if let Some(macos_dir) = exe.parent() {
            let bundled = macos_dir
                .parent()
                .map(|contents| contents.join("Resources/bin").join(name));
            if let Some(ref p) = bundled {
                if p.exists() {
                    // Remove quarantine on first use
                    let _ = Command::new("xattr")
                        .args(["-dr", "com.apple.quarantine"])
                        .arg(p)
                        .output();
                    return Some(p.clone());
                }
            }
        }
    }

    // 2. System paths
    let search_dirs = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
    ];
    for dir in &search_dirs {
        let candidate = PathBuf::from(dir).join(name);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    // 3. nvm for node
    if name == "node" {
        if let Some(home) = dirs::home_dir() {
            let nvm_dir = home.join(".nvm/versions/node");
            if nvm_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                    let mut versions: Vec<PathBuf> = entries
                        .filter_map(|e| e.ok())
                        .map(|e| e.path())
                        .collect();
                    versions.sort();
                    versions.reverse();
                    for v in versions {
                        let candidate = v.join("bin/node");
                        if candidate.exists() {
                            return Some(candidate);
                        }
                    }
                }
            }
        }
    }

    None
}

/// Run a binary and capture first line of stdout.
fn get_version(bin: &PathBuf, args: &[&str]) -> Option<String> {
    Command::new(bin)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout)
                    .ok()
                    .map(|s| s.trim().to_string())
            } else {
                None
            }
        })
}

/// Check if Docker daemon is actually running (not just installed).
fn docker_daemon_running(docker_bin: &PathBuf) -> bool {
    Command::new(docker_bin)
        .args(["info"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Check if a Docker image exists locally.
fn docker_image_exists(docker_bin: &PathBuf, image: &str) -> bool {
    Command::new(docker_bin)
        .args(["image", "inspect", image])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn find_dockerfile() -> Option<PathBuf> {
    // Check bundled resources first
    if let Ok(exe) = std::env::current_exe() {
        if let Some(macos_dir) = exe.parent() {
            let bundled = macos_dir
                .parent()
                .map(|contents| contents.join("Resources/docker/Dockerfile.browser"));
            if let Some(ref p) = bundled {
                if p.exists() {
                    return Some(p.clone());
                }
            }
        }
    }

    // Fallback: find in repo
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.clone();
        for _ in 0..10 {
            dir.pop();
            let candidate = dir.join("services/worker-node/docker/Dockerfile.browser");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    let fallback = PathBuf::from("/Users/lordamdal/Documents/fusio/fusio-space/fusio/services/worker-node/docker/Dockerfile.browser");
    if fallback.exists() {
        return Some(fallback);
    }

    None
}

#[tauri::command]
pub async fn check_dependencies() -> Result<DependencyStatus, String> {
    // --- Node.js ---
    let node = match find_dep_binary("node") {
        Some(path) => {
            let version = get_version(&path, &["--version"]);
            DepState {
                installed: true,
                version,
                path: Some(path.display().to_string()),
                install_hint: String::new(),
            }
        }
        None => DepState {
            installed: false,
            version: None,
            path: None,
            install_hint: "Node.js is required. Install via: brew install node@22".to_string(),
        },
    };

    // --- NATS ---
    let nats = match find_dep_binary("nats-server") {
        Some(path) => {
            let version = get_version(&path, &["--version"]);
            DepState {
                installed: true,
                version,
                path: Some(path.display().to_string()),
                install_hint: String::new(),
            }
        }
        None => DepState {
            installed: false,
            version: None,
            path: None,
            install_hint: "NATS server is required. Install via: brew install nats-server".to_string(),
        },
    };

    // --- Docker ---
    let docker_bin = find_dep_binary("docker");
    let docker = match &docker_bin {
        Some(path) => {
            let daemon_ok = docker_daemon_running(path);
            let version = get_version(path, &["--version"]);
            DepState {
                installed: daemon_ok,
                version,
                path: Some(path.display().to_string()),
                install_hint: if daemon_ok {
                    String::new()
                } else {
                    "Docker is installed but not running. Launch Docker Desktop.".to_string()
                },
            }
        }
        None => DepState {
            installed: false,
            version: None,
            path: None,
            install_hint: "Docker Desktop is required for browser automation. Download from docker.com".to_string(),
        },
    };

    // --- Docker Image ---
    let docker_image = match &docker_bin {
        Some(path) if docker.installed => {
            let exists = docker_image_exists(path, "fusio-browser:latest");
            DepState {
                installed: exists,
                version: if exists { Some("fusio-browser:latest".to_string()) } else { None },
                path: None,
                install_hint: if exists {
                    String::new()
                } else {
                    "Browser image not built. Click 'Build Image' to create it.".to_string()
                },
            }
        }
        _ => DepState {
            installed: false,
            version: None,
            path: None,
            install_hint: "Install Docker first, then build the browser image.".to_string(),
        },
    };

    let all_ready = node.installed && nats.installed && docker.installed && docker_image.installed;

    Ok(DependencyStatus {
        node,
        nats,
        docker,
        docker_image,
        all_ready,
    })
}

#[tauri::command]
pub async fn install_dependency(dep_name: String) -> Result<String, String> {
    match dep_name.as_str() {
        "node" => {
            let brew = find_dep_binary("brew");
            match brew {
                Some(brew_bin) => {
                    let output = Command::new(&brew_bin)
                        .args(["install", "node@22"])
                        .stdout(Stdio::piped())
                        .stderr(Stdio::piped())
                        .output()
                        .map_err(|e| format!("Failed to run brew: {}", e))?;
                    if output.status.success() {
                        Ok("Node.js installed successfully".to_string())
                    } else {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        Err(format!("brew install failed: {}", stderr))
                    }
                }
                None => Err("Homebrew not found. Install Node.js manually from https://nodejs.org".to_string()),
            }
        }
        "nats" => {
            let brew = find_dep_binary("brew");
            match brew {
                Some(brew_bin) => {
                    let output = Command::new(&brew_bin)
                        .args(["install", "nats-server"])
                        .stdout(Stdio::piped())
                        .stderr(Stdio::piped())
                        .output()
                        .map_err(|e| format!("Failed to run brew: {}", e))?;
                    if output.status.success() {
                        Ok("NATS server installed successfully".to_string())
                    } else {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        Err(format!("brew install failed: {}", stderr))
                    }
                }
                None => Err("Homebrew not found. Install NATS manually: https://nats.io/download/".to_string()),
            }
        }
        "docker_image" => {
            let docker_bin = find_dep_binary("docker")
                .ok_or("Docker not found. Install Docker Desktop first.")?;

            let dockerfile = find_dockerfile()
                .ok_or("Dockerfile.browser not found in app bundle or repository.")?;

            let dockerfile_dir = dockerfile.parent()
                .ok_or("Cannot determine Dockerfile directory")?;

            let output = Command::new(&docker_bin)
                .args([
                    "build",
                    "-t", "fusio-browser:latest",
                    "-f", &dockerfile.display().to_string(),
                    &dockerfile_dir.display().to_string(),
                ])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .map_err(|e| format!("Failed to run docker build: {}", e))?;

            if output.status.success() {
                Ok("Browser image built successfully".to_string())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Docker build failed: {}", stderr))
            }
        }
        _ => Err(format!("Unknown dependency: {}", dep_name)),
    }
}

#[tauri::command]
pub async fn open_docker_download() -> Result<(), String> {
    Command::new("open")
        .arg("https://www.docker.com/products/docker-desktop/")
        .spawn()
        .map_err(|e| format!("Failed to open browser: {}", e))?;
    Ok(())
}
