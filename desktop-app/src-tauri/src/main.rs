#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

// عنوان المنصة — غيّره إلى http://192.168.1.X:5173 للتشغيل على الشبكة المحلية
const APP_URL: &str = "https://tvcc.hnpay.live";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let url = std::env::var("TVCC_URL").unwrap_or_else(|_| APP_URL.to_string());
            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(url.parse().expect("invalid TVCC_URL")),
            )
            .title("TVCC")
            .inner_size(1280.0, 860.0)
            .min_inner_size(900.0, 600.0)
            .center()
            .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running TVCC desktop");
}
