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

    // Worker can start with just Node + NATS. Docker is only needed when a job arrives.
    let all_ready = node.installed && nats.installed;

    Ok(DependencyStatus {
        node,
        nats,
        docker,
        docker_image,
        all_ready,
    })
}

/// Install Homebrew if not present.
fn ensure_homebrew() -> Result<PathBuf, String> {
    if let Some(brew) = find_dep_binary("brew") {
        return Ok(brew);
    }
    // Install Homebrew non-interactively
    let output = Command::new("/bin/bash")
        .args([
            "-c",
            "NONINTERACTIVE=1 /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to install Homebrew: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Homebrew install failed: {}", stderr));
    }

    // Find the newly installed brew
    find_dep_binary("brew")
        .ok_or("Homebrew installed but binary not found. Restart the app.".to_string())
}

fn brew_install(formula: &str, is_cask: bool) -> Result<String, String> {
    let brew = ensure_homebrew()?;
    let mut args = vec!["install"];
    if is_cask {
        args.push("--cask");
    }
    args.push(formula);
    let output = Command::new(&brew)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run brew: {}", e))?;
    if output.status.success() {
        Ok(format!("{} installed successfully", formula))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("brew install failed: {}", stderr))
    }
}

#[tauri::command]
pub async fn install_dependency(dep_name: String) -> Result<String, String> {
    match dep_name.as_str() {
        "node" => brew_install("node@22", false),
        "nats" => brew_install("nats-server", false),
        "docker" => {
            // Try brew cask install first
            let brew = find_dep_binary("brew");
            if let Some(brew_bin) = brew {
                let output = Command::new(&brew_bin)
                    .args(["install", "--cask", "docker"])
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .output()
                    .map_err(|e| format!("Failed to run brew: {}", e))?;
                if output.status.success() {
                    // Launch Docker Desktop after install
                    let _ = Command::new("open")
                        .arg("-a")
                        .arg("Docker")
                        .spawn();
                    // Wait for Docker daemon to start (up to 30s)
                    for _ in 0..15 {
                        std::thread::sleep(std::time::Duration::from_secs(2));
                        if let Some(docker_bin) = find_dep_binary("docker") {
                            if docker_daemon_running(&docker_bin) {
                                return Ok("Docker Desktop installed and running".to_string());
                            }
                        }
                    }
                    return Ok("Docker Desktop installed. It may take a moment to start.".to_string());
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("brew install failed: {}. Download manually from docker.com", stderr));
                }
            }
            Err("Homebrew not found. Download Docker Desktop from https://www.docker.com/products/docker-desktop/".to_string())
        }
        "docker_image" => {
            let docker_bin = find_dep_binary("docker")
                .ok_or("Docker not found. Install Docker Desktop first.")?;

            if !docker_daemon_running(&docker_bin) {
                // Try launching Docker Desktop
                let _ = Command::new("open").arg("-a").arg("Docker").spawn();
                std::thread::sleep(std::time::Duration::from_secs(5));
                if !docker_daemon_running(&docker_bin) {
                    return Err("Docker daemon not running. Please launch Docker Desktop and wait for it to start.".to_string());
                }
            }

            let dockerfile = find_dockerfile()
                .ok_or("Dockerfile.browser not found in app bundle or repository.")?;

            let dockerfile_dir = dockerfile.parent()
                .ok_or("Cannot determine Dockerfile directory")?;

            let output = Command::new(&docker_bin)
                .env("DOCKER_BUILDKIT", "0")
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

/// One-click setup: install all missing dependencies in sequence.
#[tauri::command]
pub async fn setup_all() -> Result<String, String> {
    let mut steps: Vec<String> = Vec::new();

    // 1. Node (skip if bundled)
    if find_dep_binary("node").is_none() {
        match brew_install("node@22", false) {
            Ok(msg) => steps.push(msg),
            Err(e) => return Err(format!("Node.js install failed: {}", e)),
        }
    } else {
        steps.push("Node.js: ready".to_string());
    }

    // 2. NATS (skip if bundled)
    if find_dep_binary("nats-server").is_none() {
        match brew_install("nats-server", false) {
            Ok(msg) => steps.push(msg),
            Err(e) => return Err(format!("NATS install failed: {}", e)),
        }
    } else {
        steps.push("NATS: ready".to_string());
    }

    // 3. Docker
    let docker_bin = find_dep_binary("docker");
    let docker_ok = docker_bin.as_ref().map(|b| docker_daemon_running(b)).unwrap_or(false);
    if !docker_ok {
        if docker_bin.is_none() {
            // Install Docker via brew (installs brew first if needed)
            let brew_bin = ensure_homebrew()?;
            let output = Command::new(&brew_bin)
                .args(["install", "--cask", "docker"])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .map_err(|e| format!("Failed to run brew: {}", e))?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Docker install failed: {}", stderr));
            }
        }
        // Launch Docker Desktop
        let _ = Command::new("open").arg("-a").arg("Docker").spawn();
        steps.push("Docker Desktop: launching...".to_string());

        // Wait for daemon (up to 60s for first launch)
        let mut daemon_started = false;
        for _ in 0..30 {
            std::thread::sleep(std::time::Duration::from_secs(2));
            if let Some(ref db) = find_dep_binary("docker") {
                if docker_daemon_running(db) {
                    daemon_started = true;
                    break;
                }
            }
        }
        if !daemon_started {
            return Err("Docker Desktop installed but daemon didn't start within 60s. Launch it manually and retry.".to_string());
        }
        steps.push("Docker Desktop: running".to_string());
    } else {
        steps.push("Docker: ready".to_string());
    }

    // 4. Docker image
    let docker_bin = find_dep_binary("docker")
        .ok_or("Docker not available after install")?;
    if !docker_image_exists(&docker_bin, "fusio-browser:latest") {
        let dockerfile = find_dockerfile()
            .ok_or("Dockerfile.browser not found")?;
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
            .map_err(|e| format!("Docker build failed: {}", e))?;

        if output.status.success() {
            steps.push("Browser image: built".to_string());
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Docker image build failed: {}", stderr));
        }
    } else {
        steps.push("Browser image: ready".to_string());
    }

    Ok(steps.join("; "))
}

#[tauri::command]
pub async fn open_docker_download() -> Result<(), String> {
    Command::new("open")
        .arg("https://www.docker.com/products/docker-desktop/")
        .spawn()
        .map_err(|e| format!("Failed to open browser: {}", e))?;
    Ok(())
}
