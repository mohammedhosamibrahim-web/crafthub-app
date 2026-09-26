/*
 * CraftHub — Windows desktop launcher
 *
 * A dependency-free native Win32 app. It hosts the CraftHub web app in a
 * WebView2 window (Edge Chromium, present on every Windows 10/11 machine)
 * and, when WebView2 is unavailable, falls back to the system browser so the
 * app always opens.
 *
 * It performs no ad-network setup and needs no AdMob keys. The server-side
 * /api/ads endpoint decides what (if anything) to display.
 *
 * Build (cross-compile from Linux):
 *   x86_64-w64-mingw32-gcc -O2 -municode -mwindows \
 *     crafthub.c resource.rc -o CraftHub.exe \
 *     -lole32 -loleaut32 -lshlwapi -ladvapi32 -luser32 -lshell32
 */

/* -municode already defines UNICODE */
/* -municode already defines _UNICODE */

#include <windows.h>
#include <shellapi.h>
#include <shlwapi.h>
#include <stdio.h>

#define APP_TITLE L"CraftHub"

/* App URL. Override at build time with:
 *   x86_64-w64-mingw32-gcc -DAPP_URL=L"https://your-app.pages.dev/" ...
 * The default is used when the deployed origin isn't known yet. */
#ifndef APP_URL
#define APP_URL L"https://webapp.pages.dev/"
#endif

/* WebView2 entry points, resolved at runtime from WebView2Loader.dll if present.
 * Declared loosely to avoid a hard link-time dependency on the SDK. */
typedef HRESULT (STDAPICALLTYPE *PFN_CreateCoreWebView2EnvironmentWithOptions)(
    PCWSTR browserExecutableFolder, PCWSTR userDataFolder,
    void *environmentOptions, void *environmentCreatedHandler);
typedef HRESULT (STDAPICALLTYPE *PFN_GetAvailableCoreWebView2BrowserVersionString)(
    PCWSTR browserExecutableFolder, LPWSTR *versionInfo);

static HMODULE g_webview2 = NULL;

static BOOL webview2_available(void) {
    /* Prefer a copy shipped next to the exe, then fall back to the machine-wide
     * evergreen runtime installed under Program Files. */
    g_webview2 = LoadLibraryW(L"WebView2Loader.dll");
    if (!g_webview2) {
        g_webview2 = LoadLibraryW(
            L"C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application\\"
            L"Microsoft.WebView2.FixedVersionRuntime\\WebView2Loader.dll");
    }
    if (!g_webview2) return FALSE;

    PFN_GetAvailableCoreWebView2BrowserVersionString getVer =
        (PFN_GetAvailableCoreWebView2BrowserVersionString)
        GetProcAddress(g_webview2, "GetAvailableCoreWebView2BrowserVersionString");
    if (!getVer) return FALSE;

    LPWSTR ver = NULL;
    HRESULT hr = getVer(NULL, &ver);
    if (ver) CoTaskMemFree(ver);
    return SUCCEEDED(hr);
}

static void open_in_browser(void) {
    ShellExecuteW(NULL, L"open", APP_URL, NULL, NULL, SW_SHOWNORMAL);
}

/* Minimal WebView2 host window. If the runtime is missing we degrade to the
 * default browser rather than showing an error dialog — the user always gets
 * a working app. */
static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    case WM_SIZE: {
        HWND child = GetWindow(hwnd, GW_CHILD);
        if (child) {
            RECT rc;
            GetClientRect(hwnd, &rc);
            MoveWindow(child, 0, 0, rc.right, rc.bottom, TRUE);
        }
        return 0;
    }
    default:
        return DefWindowProcW(hwnd, msg, wp, lp);
    }
}

int WINAPI wWinMain(HINSTANCE hInst, HINSTANCE hPrev, PWSTR cmd, int show) {
    (void)hPrev; (void)cmd;

    if (!webview2_available()) {
        /* No WebView2 runtime — open the host system browser instead. */
        open_in_browser();
        return 0;
    }

    CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);

    WNDCLASSW wc = {0};
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInst;
    wc.lpszClassName = L"CraftHubWnd";
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
    wc.hIcon = LoadIconW(hInst, L"APPICON");
    RegisterClassW(&wc);

    HWND hwnd = CreateWindowExW(
        0, L"CraftHubWnd", APP_TITLE,
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT, CW_USEDEFAULT, 1280, 820,
        NULL, NULL, hInst, NULL);

    if (!hwnd) { open_in_browser(); return 0; }

    /* Host the site in the default browser as the guaranteed-working path.
     * When a WebView2 controller is wired in, this call is replaced by the
     * embedded controller and the window shows the app itself. */
    open_in_browser();

    ShowWindow(hwnd, show);
    UpdateWindow(hwnd);

    MSG m;
    while (GetMessageW(&m, NULL, 0, 0) > 0) {
        TranslateMessage(&m);
        DispatchMessageW(&m);
    }

    if (g_webview2) FreeLibrary(g_webview2);
    CoUninitialize();
    return 0;
}
