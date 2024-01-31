const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const St = imports.gi.St;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;

let GitHubStarsIndicator, gitHubStarsIndicator, _httpSession;

const GitHubStars = GObject.registerClass(
class GitHubStars extends PanelMenu.Button {
    _init() {
        super._init(0.0, "GitHub Stars", false);

        // Icon not working yet, all-black and not visable
        // let gicon = Gio.icon_new_for_string(`${Me.path}/icons/star.svg`); // Load the SVG icon
        // this.starIcon = new St.Icon({ gicon: gicon, icon_size: 16, style: 'color: white;' });
        // this.add_actor(this.starIcon);
        
        this.starCounterLabel = new St.Label({
            text: _("Loading..."),
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_actor(this.starCounterLabel);
        
        this.connect('button-press-event', this._refresh.bind(this));
        this._refresh();
    }

    _refresh() {
        this._getStarCount();
        this._removeTimeout();
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 600, () => {
            this._getStarCount();
            return true;
        });
    }

    _getStarCount() {
        const url = 'https://api.github.com/repos/hathach/tinyusb';
        let message = Soup.Message.new('GET', url);
        message.request_headers.append('User-Agent', 'GNOME Shell Extension (github-stars@tinyusb.org)');

        _httpSession.queue_message(message, (session, message) => {
            if (message.status_code == 200) {
              let json = JSON.parse(message.response_body.data);
              let stars = json.stargazers_count.toString();
              // this.accessible_name = `GitHub Stars: ${stars}`; // Set tooltip text here
              this.starCounterLabel.set_text(`Stars ${stars}`);
            } else {
                global.log(`Error fetching star count: Status Code ${message.status_code}`);
                this._scheduleRetry();
            }
        });
    }

    _scheduleRetry() {
        // Clear any existing timeout to avoid multiple retries stacking up
        if (this._retryTimeout) {
            GLib.Source.remove(this._retryTimeout);
            this._retryTimeout = null;
        }

        // Schedule a new retry after 10 seconds
        this._retryTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this._getStarCount();
            this._retryTimeout = null; // Reset the retry timeout ID
            return GLib.SOURCE_REMOVE; // Ensure the timeout is not repeated
        });
    }

    _removeTimeout() {
        if (this._timeout) {
            GLib.Source.remove(this._timeout);
            this._timeout = null;
        }
    }

    destroy() {
        this._removeTimeout();
        super.destroy();
    }
});

function init() {
    _httpSession = new Soup.Session();
}

function enable() {
    gitHubStarsIndicator = new GitHubStars();
    Main.panel.addToStatusArea('githubStars', gitHubStarsIndicator);
}

function disable() {
    if (gitHubStarsIndicator) {
        gitHubStarsIndicator.destroy();
        gitHubStarsIndicator = null;
    }
}

