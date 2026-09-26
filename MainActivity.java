package dev.crafthub.app;

import com.getcapacitor.BridgeActivity;

/**
 * CraftHub native shell.
 *
 * Loads the CraftHub web app into a Capacitor WebView. No AdMob SDK is
 * initialised and no app ID is required — the web app requests /api/ads and
 * renders whatever the admin configured, or nothing at all.
 */
public class MainActivity extends BridgeActivity {
}
