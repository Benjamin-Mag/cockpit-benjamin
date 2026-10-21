import type { BackgroundMessage } from './shared/messages';
import { PLEIN_ECRAN_ID, donneesPourPleinEcran } from './shared/plein-ecran';

// Cockpit Plein Écran (extension privée de Benjamin) lit les modèles, phrases et réglages : lecture seule, jamais les Ventes.
chrome.runtime.onMessageExternal.addListener((m: { type?: string } | undefined, sender, repondre: (r: unknown) => void) => {
  if (sender.id !== PLEIN_ECRAN_ID || m?.type !== 'cockpit-donnees') return;
  chrome.storage.local.get('cockpit-data').then(
    (r) => repondre({ ok: true, donnees: donneesPourPleinEcran(r['cockpit-data']) }),
    () => repondre({ ok: false, donnees: null }),
  );
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'open-panel') {
    const windowId = tab?.windowId ?? (await chrome.windows.getLastFocused()).id;
    if (windowId !== undefined) await chrome.sidePanel.open({ windowId });
    return;
  }
  if (command === 'run-mv' && tab?.id !== undefined) {
    const msg: BackgroundMessage = { type: 'command', command: 'run-mv' };
    // Le panneau (s'il est ouvert) exécute MV et affiche le résultat ; sinon le
    // script de contenu le fait directement avec le commentaire configuré.
    const handledByPanel = await chrome.runtime.sendMessage(msg).then((r) => r === true, () => false);
    if (handledByPanel) return;
    const { mvComment } = await chrome.storage.local.get('mvComment');
    chrome.tabs.sendMessage(tab.id, { type: 'runMv', comment: (mvComment as string) || 'MV' }).catch(() => {});
  }
});
