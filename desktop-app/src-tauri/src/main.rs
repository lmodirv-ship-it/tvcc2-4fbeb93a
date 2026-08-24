#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

// النطاق الافتراضي — يمكن تجاوزه بمتغير البيئة TVCC_URL أو من شاشة الربط داخل التطبيق
const APP_URL: &str = "https://tvcc.hnpay.live";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let forced = std::env::var("TVCC_URL").ok().filter(|v| !v.trim().is_empty());

            // بدون متغير بيئة: نفتح شاشة الربط المحلية، وهي تعيد التوجيه للنطاق المحفوظ تلقائياً
            let target = match forced {
                Some(url) => WebviewUrl::External(url.parse().expect("invalid TVCC_URL")),
                None => WebviewUrl::App("index.html".into()),
            };

            WebviewWindowBuilder::new(app, "main", target)
                .title("TVCC")
                .inner_size(1280.0, 860.0)
                .min_inner_size(900.0, 600.0)
                .center()
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running TVCC desktop");

    let _ = APP_URL;
}
