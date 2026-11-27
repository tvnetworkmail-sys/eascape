// RuneLite's Report Button plugin, cloned from net.runelite.client.plugins.reportbutton (BSD 2-Clause, Copyright (c) 2018,
// Magic fTail and RuneLite contributors): ReportButtonPlugin, ReportButtonConfig, TimeStyle, TimeFormat.
// 2007: the chat bar's "Report Abuse" button is toplevel 548's text component 26 (OSRS: Chatbox.REPORTABUSE_TEXT1), so
// the text goes there with the core's display-only setText, in the button's own font and colour; shut down puts the
// 2007 text back. The 2007 core goes from LOGIN_SCREEN straight to LOGGED_IN, so the login screen arms the timer too.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, GameState } = rl;
  const GROUP = 'reportButton';
  const REPORTABUSE_TEXT1 = (548 << 16) | 26;
  const ORIGINAL_TEXT = 'Report Abuse';
  const CLIENT_TICK_LENGTH = 20;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  // DateTimeFormatter "HH:mm:ss" / FormatStyle.MEDIUM (en: h:mm:ss a)
  const fmt24 = (h, m, s) => `${pad(h)}:${pad(m)}:${pad(s)}`;
  const fmt12 = (h, m, s) => `${h % 12 === 0 ? 12 : h % 12}:${pad(m)}:${pad(s)} ${h < 12 ? 'AM' : 'PM'}`;
  const zoned = (tz) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date());
    const v = (t) => parseInt((parts.find((p) => p.type === t) || {}).value, 10) || 0;
    return [v('hour') % 24, v('minute'), v('second')];
  };

  class ReportButtonPlugin {
    constructor() { this.configGroup = GROUP; this.loginTime = null; this.ticksSinceLogin = 0; this.ready = false; this.timeFormat = fmt12; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.updateReportButtonTime();
      this.updateTimeFormat();
      // @Schedule(period = 500, unit = MILLIS) updateSchedule
      this.timer = setInterval(() => this.updateSchedule(), 500);
    }
    shutDown() {
      clearInterval(this.timer);
      const reportButton = client.getWidget(REPORTABUSE_TEXT1);
      if (reportButton != null) reportButton.setText(ORIGINAL_TEXT);
    }
    onGameStateChanged(event) {
      switch (event.getGameState()) {
        case GameState.LOGIN_SCREEN: // (2007: no LOGGING_IN state)
        case GameState.LOGGING_IN:
        case GameState.HOPPING:
          this.ready = true;
          break;
        case GameState.LOGGED_IN:
          if (this.ready) {
            this.loginTime = Date.now();
            this.ticksSinceLogin = 0;
            this.ready = false;
          }
          break;
        default:
      }
    }
    onGameTick() {
      this.ticksSinceLogin++;
      if (this.config.time() === 'GAME_TICKS') this.updateReportButtonTime();
    }
    onConfigChanged(event) {
      if (event.getGroup() === GROUP && event.getKey() === 'switchTimeFormat') this.updateTimeFormat();
    }
    updateSchedule() { this.updateReportButtonTime(); }
    updateReportButtonTime() {
      if (client.getGameState() !== GameState.LOGGED_IN) return;
      const reportButton = client.getWidget(REPORTABUSE_TEXT1);
      if (reportButton == null) return;
      switch (this.config.time()) {
        case 'UTC': reportButton.setText(this.getUTCTime()); break;
        case 'JAGEX': reportButton.setText(this.getJagexTime()); break;
        case 'LOCAL_TIME': reportButton.setText(this.getLocalTime()); break;
        case 'LOGIN_TIME': reportButton.setText(this.getLoginTime()); break;
        case 'IDLE_TIME': reportButton.setText(this.getIdleTime()); break;
        case 'DATE': reportButton.setText(ReportButtonPlugin.getDate()); break;
        case 'GAME_TICKS': reportButton.setText(this.getGameTicks()); break;
        default:
      }
    }
    getIdleTime() {
      const lastActivity = Math.min(client.getMouseIdleTicks(), client.getKeyboardIdleTicks());
      const secs = Math.floor((lastActivity * CLIENT_TICK_LENGTH) / 1000);
      return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`; // DurationFormatUtils "mm:ss"
    }
    getLoginTime() {
      if (this.loginTime == null) return 'Report';
      const s = Math.floor((Date.now() - this.loginTime) / 1000) % 86400; // LocalTime.ofSecondOfDay, "HH:mm:ss"
      return fmt24(Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60);
    }
    getGameTicks() { return String(this.ticksSinceLogin); }
    getLocalTime() { const d = new Date(); return this.timeFormat(d.getHours(), d.getMinutes(), d.getSeconds()); }
    getUTCTime() { const d = new Date(); return this.timeFormat(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()); }
    getJagexTime() { return this.timeFormat(...zoned('Europe/London')); }
    static getDate() { const d = new Date(); return `${MONTHS[d.getMonth()]}. ${pad(d.getDate())}, ${d.getFullYear()}`; } // "MMM. dd, yyyy"
    updateTimeFormat() { this.timeFormat = this.config.switchTimeFormat() === 'TIME_24H' ? fmt24 : fmt12; }
  }

  const plugin = new ReportButtonPlugin();
  ll.__reportbutton = { plugin };
  rl.registerPlugin('reportbutton', plugin);
})();
