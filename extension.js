const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const St = imports.gi.St;
const Main = imports.ui.main;
const {GLib, Soup} = imports.gi;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;

let gitHubStarsIndicator, _httpSession;

const GitHubStars = GObject.registerClass(
class GitHubStars extends PanelMenu.Button {
    _init() {
        super._init(0.0, "GitHub Stars", false);        
        this.starCounterLabel = new St.Label({
            text: _("..."),
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_actor(this.starCounterLabel);
        
        this.connect('button-press-event', this._refresh.bind(this));
        this._refresh();
    }

    _refresh() {
        this._getRepoDetails();
        this._removeTimeout();
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 600, () => {
            this._getRepoDetails();
            return true;
        });
    }

    _getRepoDetails() {
        const url = 'https://api.github.com/repos/hathach/tinyusb';
        const pullsUrl = `https://api.github.com/search/issues?q=repo:hathach/tinyusb+type:pr+is:open`;
        let stars = "?";
        let forks = "?"; 
        let issues = "?";
        let pulls = "?";
        
        let message = Soup.Message.new('GET', url);
        message.request_headers.append('User-Agent', 'GNOME Shell Extension (github-stars@tinyusb.org)');
        _httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
            try {
                if (message.get_status() === Soup.Status.OK) {
                    let responseBytes = _httpSession.send_and_read_finish(result);
                    let decoder = new TextDecoder('utf-8');
                    let response = decoder.decode(responseBytes.get_data());                
                    let json = JSON.parse(response);
                    
                    if (json.stargazers_count !== undefined) {
                        stars = json.stargazers_count.toString();
                    }                    
                    if (json.forks_count != undefined) {
                        forks = json.forks_count.toString();
                    }

                    // Now fetch the open pull requests count
                    let pullsMessage = Soup.Message.new('GET', pullsUrl);
                    pullsMessage.request_headers.append('User-Agent', 'GNOME Shell Extension (github-stars@tinyusb.org)');
                    _httpSession.send_and_read_async(pullsMessage, GLib.PRIORITY_DEFAULT, null, (session, pullsResult) => {
                        try {
                            if (pullsMessage.get_status() === Soup.Status.OK) {
                                let pullsResponseBytes = _httpSession.send_and_read_finish(pullsResult);
                                let pullsResponse = decoder.decode(pullsResponseBytes.get_data());
                                let pullsJson = JSON.parse(pullsResponse);
                                if (pullsJson.total_count !== undefined) {
                                    pulls = pullsJson.total_count.toString();
                                    
                                    if (json.open_issues_count !== undefined) {
                                        // Calculate actual issues by excluding pulls
                                        issues = (json.open_issues_count - pullsJson.total_count).toString();
                                    }
                                }
                            }                            
                            // this.starCounterLabel.set_text(`${stars} ⭐ ${forks} 🔱 ${issues} 🎯 ${pulls} 🧩`);
                            this.starCounterLabel.set_text(`${stars} ⭐ ${issues} 🎯 ${pulls} 🧩`);
                        } catch (e) {
                            global.logError(`Exception in _getRepoDetails (pulls): ${e}`);
                        }
                    });                
                }
            } catch (e) {
                global.logError(`Exception in _getRepoDetails: ${e}`);
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
            this._getRepoDetails();
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

