/*
 * JSCardList
 */
// configObject is an object as such: {'containerSelector':'id', 'stylemap':{'border':'none','background':'none'}, 'multiselect':true}
JSCardList = function(configObject) {
    this.items = [];
    this.multiselect = configObject.multiselect;
    this.containerSelector = '#' + configObject.containerSelector;
    $(this.containerSelector).css("position", "relative");
    var tmpContainer = $('<div class="menuContainerJSCardList" style="position:absolute;top:0;bottom:0;left:0;right:0;"></div>');
    if(configObject.stylemap)
        tmpContainer.css(configObject.stylemap);

    this.menuContainerHTML = tmpContainer.clone().wrap('<div></div>').parent().html();//need to get tmpContainer's html itself
    this.menuContainer = null;
};

JSCardList.prototype.clear = function() {
    this.items = [];
    this.refresh();
};

JSCardList.prototype.addItem = function(item) {
    this.items.push(item);
    this.refresh();
};

JSCardList.prototype.addItems = function(newItems) {
    this.items = this.items.concat(newItems);
    this.refresh();
};

JSCardList.prototype.setItems = function(newItems) {
    this.items = newItems;
    this.refresh();
};

JSCardList.prototype.removeAt = function(index) {
    this.items.splice(index, 1);
    this.refresh();
};

JSCardList.prototype.refresh = function() {

    if(this.menuContainer)//is this right? or should it be $(this.menuContainer)?
        this.menuContainer.unbind();

    $(this.containerSelector).html(this.menuContainerHTML);
    this.menuContainer = $(this.containerSelector + ' .menuContainerJSCardList');

    for(var i in this.items) {
        var item = this.items[i];
        var renderedItemHTML = item.render();

        $( "<li></li>" ).data("jscardlist.item", item).attr("enabled", item.enabled).attr("activated", item.selected).append($(renderedItemHTML)).appendTo(this.menuContainer);
    }
    var self = this;
    $(this.menuContainer).cardlist(
        {
            selected:
                function( event, ui ) {
                    var item = ui.item.data( "jscardlist.item" );

                    if(!self.multiselect) {
                        //set items unselected, no refresh
                        self.selectNone(true);
                        item.selected = true;
                    } else {
                        //toggle
                        item.selected = !item.selected;
                    }

                    item.onClick();//TODO: should we pass event data?
                    return true;
                },
            dblselected:
                function( event, ui ) {
                    var item = ui.item.data( "jscardlist.item" );
                    item.onDblClick();//TODO: should we pass event data?
                    return true;
                },
            multiselect: this.multiselect
        }
    );

    //$(this.menuContainer).disableSelection();
};

JSCardList.prototype.setSelectedItem = function(item) {
    if(!this.multiselect) {
        this.selectNone();
    }
    if(item) {
        item.selected = true;
        this.refresh();
    }
};

JSCardList.prototype.setSelectedIndex = function(index) {
    if(this.items[index]) {
        this.setSelectedItem(this.items[index]);
    }
};

JSCardList.prototype.getSelectedItems = function() {
    var selectedItems = [];
    for(var i in this.items) {
        if(this.items[i].selected) {
            selectedItems.push(this.items[i]);
        }
    }
    return selectedItems;
};

JSCardList.prototype.selectAll = function() {
    for(var i in this.items) {
        this.items[i].selected = true;
    }
    this.refresh();
};

JSCardList.prototype.selectNone = function(skipRefresh) {
    for(var i in this.items) {
        this.items[i].selected = false;
    }
    if(!skipRefresh) {
        this.refresh();
    }
};

JSCardList.prototype.getItemIndex = function(item) {
    for(var i in this.items)
    {
        if(this.items[i] == item)
            return i;
    }
    return null;
};

JSCardList.Item = Class.extend({

    value: "",//what is shown in the item
    enabled: true,
    selected: false,

    init: function() {

    },

    render: function() {
        return '<a href="#">' + this.value + '</a>'; //this allows painting to be overridden in classes which extend JSListBox.Item
    },

    onClick: function() {
        //console.log('JSListBox.Item Click');
    },
    onDblClick: function() {
        //console.log('JSListBox.Item DblClick');
    }
});

(function($) {

    $.widget("ui.cardlist", {
        options: {
            multiselect: false
        },
        _create: function() {
            var self = this;
            this.element
                //.addClass("ui-menu ui-widget ui-widget-content ui-corner-all")
                .addClass("ui-cardlist")
                .attr({
                    role: "listbox",
                    "aria-activedescendant": "ui-active-menuitem"
                })
                .click(function( event ) {
                    if ( !$( event.target ).closest( ".ui-cardlist-item a" ).length ) {
                        return;
                    }
                    if(self.highlighted)
                    {
                        self.activate( event, self.highlighted );
                        // temporary
                        event.preventDefault();
                        self.select( event );
                    }
                })
                .dblclick(function( event ) {
                    if ( !$( event.target ).closest( ".ui-cardlist-item a" ).length ) {
                        return;
                    }
                    // temporary
                    if(self.highlighted)
                    {
                        event.preventDefault();
                        self.dblselect( event );
                    }
                });
            this.refresh();
        },

        refresh: function() {
            var self = this;

            // don't refresh list items that are already adapted
            var items = this.element.children("li:not(.ui-cardlist-item):has(a)")
                .addClass("ui-cardlist-item")
                .attr("role", "menuitem");

            items.children("a")
                .addClass("ui-corner-all")
                .attr("tabindex", -1)
                // mouseenter doesn't work with event delegation
                .mouseenter(function( event ) {
                    //self.activate( event, $(this).parent() );
                    self.highlight( event, $(this).parent() );
                })
                .mouseleave(function() {
                    //self.deactivate();
                    self.lowlight();
                });

            //check for activated to select
            for( var i = 0; i < items.length; i++)
            {
                var item = $(items[i]);
                if(item.attr("activated") == "true")
                    self.activate(null, item);
            }
        },

        highlight: function( event, item) {
            this.lowlight();
            //only allow highlight if item attr enabled = true
            if(item.attr("enabled") == "true")
            {
                this.highlighted = item.eq(0)
                    .children("a")
                    .addClass("ui-listbox-state-highlight")
                    //.attr("id", "ui-active-menuitem")
                    .end();
            }
        },

        lowlight: function() {
            if (!this.highlighted) { return; }

            this.highlighted.children("a")
                .removeClass("ui-listbox-state-highlight");
            //.removeAttr("id");
            //this._trigger("blur");
            this.highlighted = null;
        },

        activate: function( event, item ) {
            var activate = true;
            if(!this.options.multiselect) {
                this.deactivate();
            } else if(item.children("a").attr("id") == "ui-active-menuitem") {
                //only toggle off
                activate = false;
                this.active = item.eq(0)
                    .children("a")
                    .removeClass("ui-state-hover")
                    .removeAttr("id")
                    .end();
                this._trigger("blur");
            }
            if(activate) {

                if (this.hasScroll()) {
                    var offset = item.offset().top - this.element.offset().top,
                        scroll = this.element.attr("scrollTop"),
                        elementHeight = this.element.height();
                    if (offset < 0) {
                        this.element.attr("scrollTop", scroll + offset);
                    } else if (offset >= elementHeight) {
                        this.element.attr("scrollTop", scroll + offset - elementHeight + item.height());
                    }
                }
                this.active = item.eq(0)
                    .children("a")
                    .addClass("ui-state-hover")
                    .attr("id", "ui-active-menuitem")
                    .end();
                this._trigger("focus", event, {item: item});
            }
        },

        deactivate: function() {
            if (!this.active) { return; }

            this.active.children("a")
                .removeClass("ui-state-hover")
                .removeAttr("id");
            this._trigger("blur");
            this.active = null;
        },

        hasScroll: function() {
            return this.element.height() < this.element.attr("scrollHeight");
        },

        select: function( event ) {
            this._trigger("selected", event, { item: this.active });
        },
        dblselect: function( event ) {
            this._trigger("dblselected", event, { item: this.active });
        }
    });

}(jQuery));