var Profile = function(character, items, index) {
    var self = this;

    this.profile = character;
    this.order = ko.observable();
    this.icon = ko.observable("");
    this.background = ko.observable("");
    this.items = ko.observableArray().extend({
        rateLimit: {
            timeout: 500,
            method: "notifyWhenChangesStop"
        }
    });
    this.uniqueName = "";
    this.classLetter = "";
    this.race = "";
    this.reloadingBucket = false;
    this.statsShowing = ko.observable(false);
    this.weapons = ko.computed(this._weapons, this);
    this.armor = ko.computed(this._armor, this);
    this.general = ko.computed(this._general, this);
    this.postmaster = ko.computed(this._postmaster, this);
    this.messages = ko.computed(this._messages, this);
    this.invisible = ko.computed(this._invisible, this);
    this.lostItems = ko.computed(this._lostItems, this);
    this.container = ko.observable();
    this.lostItemsHelper = [420519466, 1322081400, 2551875383];
    this.invisibleItemsHelper = [2910404660, 2537120989];
    this.reloadBucket = _.bind(this._reloadBucket, this);
    this.init(items, index);
}

Profile.prototype = {
    init: function(rawItems, index) {
        var self = this;

        if (_.isString(self.profile)) {
            self.order(parseInt(app.vaultPos()));
            self.background(app.makeBackgroundUrl("assets/vault_emblem.jpg", true));
            self.icon(app.makeBackgroundUrl("assets/vault_icon.jpg", true));

            self.gender = "Tower";
            self.classType = "Vault";
            self.id = "Vault";
            self.imgIcon = "assets/vault_icon.jpg";

            self.level = "";
            self.stats = "";
            self.percentToNextLevel = "";
            self.race = "";
        } else {
            self.order(index);
            self.background(app.makeBackgroundUrl(self.profile.backgroundPath));
            self.icon(app.makeBackgroundUrl(self.profile.emblemPath));

            self.gender = tgd.DestinyGender[self.profile.characterBase.genderType];
            self.classType = tgd.DestinyClass[self.profile.characterBase.classType];
            self.id = self.profile.characterBase.characterId;
            self.imgIcon = app.bungie.getUrl() + self.profile.emblemPath;

            self.level = self.profile.characterLevel;
            self.stats = self.profile.characterBase.stats;
            if (!("STAT_LIGHT" in self.stats))
                self.stats.STAT_LIGHT = 0;
            self.percentToNextLevel = self.profile.percentToNextLevel;
            self.race = _raceDefs[self.profile.characterBase.raceHash].raceName;
        }
        self.classLetter = self.classType[0].toUpperCase();
        self.uniqueName = self.level + " " + self.race + " " + self.gender + " " + self.classType

        var processedItems = [];
        _.each(rawItems, function(item) {
            var processedItem = new Item(item, self);
            if ("id" in processedItem) processedItems.push(processedItem);
        });
        self.items(processedItems);
    },
    getBucketTypeHelper: function(item, info) {
        var self = this;
        if (item.location !== 4) {
            return tgd.DestinyBucketTypes[info.bucketTypeHash];
        }
        if (item.isEquipment) {
            return "Lost Items";
        }
        if (self.lostItemsHelper.indexOf(item.itemHash) > -1) {
            return "Lost Items";
        }
        if (self.invisibleItemsHelper.indexOf(item.itemHash) > -1) {
            return "Invisible";
        }
        return "Messages";
    },
    reloadBucketFilter: function(buckets) {
        var self = this;
        return function(item) {
            var info = window._itemDefs[item.itemHash];
            if (info.bucketTypeHash in tgd.DestinyBucketTypes) {
                var itemBucketType = self.getBucketTypeHelper(item, info);
                if (buckets.indexOf(itemBucketType) > -1) {
                    return true;
                }
            }
        }
    },
    reloadBucketHandler: function(buckets, done) {
        var self = this;
        return function(results, response) {
            if (results && results.data && results.data.buckets) {
                var items = _.filter(app.bungie.flattenItemArray(results.data.buckets), self.reloadBucketFilter(buckets));
                _.each(items, function(item) {
                    self.items.push(new Item(item, self, true));
                });
                done();
            } else {
                done();
                self.refresh();
                return BootstrapDialog.alert("Code 20: " + self.activeText().error_loading_inventory + JSON.stringify(response));
            }
        }
    },
    _reloadBucket: function(model, event, callback) {
        var self = this,
            element;
        if (self.reloadingBucket) {
            return;
        }

        var buckets = [];
        if (typeof model === 'string' || model instanceof String) {
            buckets.push(model);
        } else if (model instanceof Layout) {
            buckets.push.apply(buckets, model.bucketTypes);
        } else if (model instanceof Profile) {
            _.each(tgd.DestinyLayout, function(layout) {
                _.each(layout, function(l) {
                    buckets.push.apply(buckets, l.bucketTypes);
                });
            });
        }

        self.reloadingBucket = true;
        if (typeof event !== "undefined") {
            element = $(event.target).is(".fa") ? $(event.target) : $(event.target).find(".fa");
            if (element.is(".fa") == false) {
                element = $(event.target).is(".emblem") ? $(event.target) : $(event.target).find(".emblem");
                if (element.is(".emblem") == false) {
                    element = $(event.target).parent().find(".emblem");
                }
            }
            element.addClass("fa-spin");
        }

        var needsInvisibleRefresh = buckets.indexOf("Invisible") > -1;

        function done() {
            function reallyDone() {
                self.reloadingBucket = false;
                if (element) {
                    element.removeClass("fa-spin");
                    setTimeout(function() {
                        app.bucketSizeHandler();
                    }, 1000);
                }
            }

            if (needsInvisibleRefresh) {
                app.bungie.account(function(results, response) {
                    if (results && results.data && results.data.inventory && results.data.inventory.buckets && results.data.inventory.buckets.Invisible) {
                        var invisible = results.data.inventory.buckets.Invisible;
                        invisible.forEach(function(b) {
                            b.items.forEach(function(item) {
                                self.items.push(new Item(item, self, true));
                            });
                        });
                        reallyDone();
                    } else {
                        reallyDone();
                        self.refresh();
                        return BootstrapDialog.alert("Code 40: " + self.activeText().error_loading_inventory + JSON.stringify(response));
                    }
                });
            } else {
                reallyDone();
            }
            if (callback)
                callback();
        }

        var itemsToRemove = _.filter(self.items(), function(item) {
            return buckets.indexOf(item.bucketType) > -1;
        });
        self.items.removeAll(itemsToRemove);

        if (self.id == "Vault") {
            app.bungie.vault(self.reloadBucketHandler(buckets, done));
        } else {
            app.bungie.inventory(self.id, self.reloadBucketHandler(buckets, done));
        }
    },
    _weapons: function() {
        return _.filter(this.items(), function(item) {
            if (item.weaponIndex > -1)
                return item;
        });
    },
    _armor: function() {
        return _.filter(this.items(), function(item) {
            if (item.armorIndex > -1)
                return item;
        });
    },
    _general: function() {
        return _.filter(this.items(), function(item) {
            if (item.armorIndex == -1 && item.weaponIndex == -1 && item.bucketType !== "Post Master" && item.bucketType !== "Messages" && item.bucketType !== "Invisible" && item.bucketType !== "Lost Items" && item.bucketType !== "Subclasses")
                return item;
        });
    },
    _postmaster: function() {
        return _.filter(this.items(), function(item) {
            if ((item.bucketType == "Post Master") || (item.bucketType == "Messages") || (item.bucketType == "Invisible") || (item.bucketType == "Lost Items"))
                return item;
        });
    },
    _messages: function() {
        return _.filter(this.items(), function(item) {
            if (item.bucketType == "Messages")
                return item;
        });
    },
    _invisible: function() {
        return _.filter(this.items(), function(item) {
            if (item.bucketType == "Invisible")
                return item;
        });
    },
    _lostItems: function() {
        return _.filter(this.items(), function(item) {
            if (item.bucketType == "Lost Items")
                return item;
        });
    },
    filterItemByType: function(type, isEquipped) {
        return function(item) {
            return (item.bucketType == type && item.isEquipped() == isEquipped);
        }
    },
    get: function(type) {
        return _.sortBy(_.sortBy(this.items().filter(this.filterItemByType(type, false)), function(item) {
            return item.type;
        }), function(item) {
            return item.tierType * -1;
        });
    },
    getVisible: function(type) {
        return _.filter(this.get(type), function(item) {
            return item.isVisible();
        });
    },
    itemEquipped: function(type) {
        return ko.utils.arrayFirst(this.items(), this.filterItemByType(type, true));
    },
    itemEquippedVisible: function(type) {
        var ie = this.itemEquipped(type);
        return ie == undefined ? false : ie.isVisible();
    },
    toggleStats: function() {
        this.statsShowing(!this.statsShowing());
    }
}