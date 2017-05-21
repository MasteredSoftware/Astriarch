Astriarch.ResearchControl = {
    dialog: null,//instance of Astriarch.Dialog
    researchItemsCompleteListBox: null,
    jqElm: {},

    init: function() {
        Astriarch.ResearchControl.jqElm.buttonSubmitCustomShip = $('#ButtonSubmitCustomShip');

        Astriarch.ResearchControl.jqElm.sliderResearchPercent = $('#SliderResearchPercent');
        Astriarch.ResearchControl.jqElm.buttonIncreaseResearch = $('#ButtonIncreaseResearch');
        Astriarch.ResearchControl.jqElm.researchPercentDescription = $('#ResearchPercentDescription');
        Astriarch.ResearchControl.jqElm.taxPercentDescription = $('#TaxPercentDescription');
        Astriarch.ResearchControl.jqElm.buttonIncreaseTaxes = $('#ButtonIncreaseTaxes');

        Astriarch.ResearchControl.jqElm.researchNewShipTypeHullType = $('#ResearchNewShipTypeHullType');
        Astriarch.ResearchControl.jqElm.researchNewShipTypeAdvantageBox = $('#ResearchNewShipTypeAdvantageBox');
        Astriarch.ResearchControl.jqElm.researchNewShipTypeDisadvantageBox = $('#ResearchNewShipTypeDisadvantageBox');

        Astriarch.ResearchControl.jqElm.sliderResearchPercent.slider({value:0, step:10, min:0, max:100, slide: function(event, ui) { Astriarch.ResearchControl.SliderResearchPercentValueChanged(ui.value);} });

        Astriarch.ResearchControl.jqElm.buttonSubmitCustomShip.button();
        Astriarch.ResearchControl.jqElm.buttonSubmitCustomShip.click(
            function() {
                Astriarch.ResearchControl.ButtonSubmitCustomShipClick();
            }
        );

        Astriarch.ResearchControl.jqElm.buttonIncreaseResearch.button({ icons: {primary:'icon-16x16-research'}, text: false });
        Astriarch.ResearchControl.jqElm.buttonIncreaseResearch.click(
            function() {
                var newSliderValue = Astriarch.ResearchControl.jqElm.sliderResearchPercent.slider("value") + 10;
                Astriarch.ResearchControl.SliderResearchPercentValueChanged(newSliderValue);
            }
        );

        Astriarch.ResearchControl.jqElm.buttonIncreaseTaxes.button({ icons: {primary:'icon-16x16-credits'}, text: false });
        Astriarch.ResearchControl.jqElm.buttonIncreaseTaxes.click(
            function() {
                var newSliderValue = Astriarch.ResearchControl.jqElm.sliderResearchPercent.slider("value") - 10;
                Astriarch.ResearchControl.SliderResearchPercentValueChanged(newSliderValue);
            }
        );

        Astriarch.ResearchControl.researchTypeProgressCardList = new JSCardList({'containerSelector':'ResearchTypeProgressCardList', 'multiselect':false});

        Astriarch.ResearchControl.dialog = new Astriarch.Dialog('#researchControlDialog', 'Research and Development', 470, 425, Astriarch.ResearchControl.OKClose);
    },

    show: function() {
        Astriarch.ResearchControl.dialog.open();

        this.refreshUIFromState();
    },

    refreshUIFromState: function() {
        this.refreshResearchPercentSliderArea();
        this.refreshResearchTypeProgressCardList();
        this.refreshInDesignResearchArea();
    },

    refreshResearchPercentSliderArea: function() {
        var value = Astriarch.ClientGameModel.MainPlayer.Research.researchPercent * 100;
        Astriarch.ResearchControl.jqElm.researchPercentDescription.text(value);
        Astriarch.ResearchControl.jqElm.taxPercentDescription.text(100 - value);

        Astriarch.ResearchControl.jqElm.sliderResearchPercent.slider("value", value);
    },

    refreshInDesignResearchArea: function() {

        var projectStatusHtml = "No active research project. Click on a research area below to have your scientists and engineers start researching in that area.";
        if(Astriarch.ClientGameModel.MainPlayer.Research.researchTypeInQueue) {
            var rtpInQueue = Astriarch.ClientGameModel.MainPlayer.Research.researchProgressByType[Astriarch.ClientGameModel.MainPlayer.Research.researchTypeInQueue];
            projectStatusHtml = "Currently Researching: " + rtpInQueue.ToString(true) + ", Estimated Turns Remaining: " + Astriarch.ClientGameModel.MainPlayer.Research.estimateTurnsRemainingInQueue(Astriarch.ClientGameModel.MainPlayer.GetTaxRevenueAtMaxPercent());
        }
        $("#CurrentResearchProjectStatusArea").html(projectStatusHtml);

        $("#CurrentResearchAreaCustomShipDetails").hide();
        $("#CurrentResearchProjectStatusArea").show();
    },

    SliderResearchPercentValueChanged: function(value) {
        if(value < 0 || value > 100) {
            return;
        }
        //TODO: do we need to throttle these messages?
        var percent = value/100;

        Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.ADJUST_RESEARCH_PERCENT, payload:{"researchPercent":percent}});

        Astriarch.ClientGameModel.MainPlayer.Research.researchPercent = percent;

        this.refreshResearchPercentSliderArea();
        this.refreshInDesignResearchArea();
    },

    buildCustomShipComboBoxes: function(selectedItem){

        var defenderOption = selectedItem.ResearchTypeProgress.type == Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DEFENDER ? '' : '<option value="1">Defenders</option>';
        var mobileShipOptions = '<option value="2" selected="">Scouts</option><option value="3">Destroyers</option><option value="4">Cruisers</option><option value="5"">Battleships</option>';
        Astriarch.ResearchControl.jqElm.researchNewShipTypeAdvantageBox.html('<select id="ResearchNewShipTypeAdvantageComboBox">' + defenderOption + mobileShipOptions + '</select>');
        Astriarch.ResearchControl.jqElm.researchNewShipTypeDisadvantageBox.html('<select id="ResearchNewShipTypeDisadvantageComboBox">' + defenderOption + mobileShipOptions  + '</select>');

        //jquery ui selectmenu
        //from https://github.com/fnagel/jquery-ui
        //also here: http://jquerystyle.com/2009/08/24/jquery-ui-selectmenu
        $('select#ResearchNewShipTypeAdvantageComboBox').selectmenu({width:110});
        $('select#ResearchNewShipTypeDisadvantageComboBox').selectmenu({width:110});
    },

    ButtonSubmitCustomShipClick: function() {

        var selectedItems = Astriarch.ResearchControl.researchTypeProgressCardList.getSelectedItems();
        if (selectedItems && selectedItems.length) {
            var rtpi = selectedItems[0];

            var data = {};
            data.advantageAgainst = Number($('select#ResearchNewShipTypeAdvantageComboBox').val());
            data.disadvantageAgainst = Number($('select#ResearchNewShipTypeDisadvantageComboBox').val());

            this.SubmitResearchTypeProgress(rtpi.ResearchTypeProgress.type, data);
        }
    },

    SubmitResearchTypeProgress: function(type, data) {
        var ri = {type:type, data:data};

        Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.SUBMIT_RESEARCH_ITEM, payload:{"researchItem":ri}});

        Astriarch.ClientGameModel.MainPlayer.Research.setResearchTypeProgressInQueue(type, data);

        this.refreshInDesignResearchArea();
    },

    /*
    ButtonCancelCurrentResearchProjectClick: function(){
        //TODO: confirm with/warn the user

        Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.CANCEL_RESEARCH_ITEM, payload:{}});

        Astriarch.ClientGameModel.MainPlayer.Research.researchItemInQueue = null;

    },*/

    refreshResearchTypeProgressCardList: function() {
        var cardListItems = [];
        var itemToSelect = null;
        for(var t in Astriarch.ClientGameModel.MainPlayer.Research.researchProgressByType) {
            var rtp = Astriarch.ClientGameModel.MainPlayer.Research.researchProgressByType[t];
            var rtpi = new Astriarch.ResearchControl.ResearchTypeProgressCardListItem(rtp);
            cardListItems.push(rtpi);
            if(Astriarch.ClientGameModel.MainPlayer.Research.researchTypeInQueue == t) {
                itemToSelect = rtpi;
            }
        }
        Astriarch.ResearchControl.researchTypeProgressCardList.setItems(cardListItems);
        if(itemToSelect) {
            Astriarch.ResearchControl.researchTypeProgressCardList.setSelectedItem(itemToSelect);
        }
    },

    ResearchTypeProgressCardListItemClicked: function(){
        var selectedItems = Astriarch.ResearchControl.researchTypeProgressCardList.getSelectedItems();
        if (selectedItems && selectedItems.length) {
            var rtpi = selectedItems[0];

            //if it's a custom ship type we haven't started
            if(rtpi.ResearchTypeProgress.isCustomShip && !rtpi.ResearchTypeProgress.researchPointsCompleted) {
                $("#CurrentResearchProjectStatusArea").hide();
                $('#CurrentResearchAreaCustomShipDetails').show();

                Astriarch.ResearchControl.jqElm.researchNewShipTypeHullType.text(rtpi.ResearchTypeProgress.GetFriendlyName());
                Astriarch.ResearchControl.buildCustomShipComboBoxes(rtpi);
            } else {
                this.SubmitResearchTypeProgress(rtpi.ResearchTypeProgress.type, rtpi.ResearchTypeProgress.data);
                this.refreshInDesignResearchArea();
            }
        }
    },

    OKClose: function()	{
        if(window.tour.enabled && (window.tour.step == 39)){
            window.tour.jqElm.joyride('nextTip');
        }

        Astriarch.View.updatePlayerStatusPanel();
    },

    Close: function() {
        Astriarch.ResearchControl.dialog.dlg.dialog('close');
    }
};


/**
 * AvailableImprovementCardListItem is a list box item for the available items to build list
 * @constructor
 */
Astriarch.ResearchControl.ResearchTypeProgressCardListItem = JSCardList.Item.extend({

    Tooltip: "",
    ResearchTypeProgress: null,
    CanResearch: true,
    Foreground: "white",
    Hotkey: null,

    /**
     * initializes this ResearchTypeProgressCardListItem
     * @this {Astriarch.PlanetView.ResearchTypeProgressCardListItem}
     */
    init: function(/*ResearchTypeProgress*/ researchTypeProgress, hotkey) {
        if(!researchTypeProgress.researchPointsCompleted) {
            this.Tooltip = Astriarch.GameTools.ResearchTypeToHelpText(researchTypeProgress.type);
        } else {
            this.Tooltip = researchTypeProgress.GetCurrentLevelDataString();
        }

        this.ResearchTypeProgress = researchTypeProgress;
        this.CanResearch = this.ResearchTypeProgress.canResearch();
        this.Hotkey = hotkey;
    },

    /**
     * renders this ResearchTypeProgressCardListItem
     * @this {Astriarch.PlanetView.ResearchTypeProgressCardListItem}
     * @return {string}
     */
    render: function() {
        this.enabled = false;
        if(!this.CanResearch)
            this.Foreground = "darkgray";
        else {
            this.Foreground = "white";
            this.enabled = true;
        }

        var imageClassName = Astriarch.GameTools.ResearchTypeToClassName(this.ResearchTypeProgress.type);
        var researchLevelData = this.ResearchTypeProgress.GetResearchLevelData();//{currentResearchLevel: this.currentResearchLevel + 1,researchCostToNextLevel: 0, percentComplete:0};
        var text = "";

        var element = '<span class="rtpItem">' +
            '<span class="rtpItemName">' + text + '</span>' +
            '<div class="rtpItemImg '+imageClassName+'" />' +
            '<div class="rtpPercentCompleteContainer"><div class="rtpHealthBar" style="background:#369;height:'+ (this.CanResearch ? researchLevelData.percentComplete * 100 : 0) + '%" /></div>' +
            '<span class="rtpItemLevel">' + (researchLevelData.currentResearchLevel || '') + '</span>' +
            '</span>';

        return '<a class="rtpItemAnchor" ' + (this.enabled ? 'href="#" ' : '') + 'title="' + this.Tooltip + '" style="color:' + this.Foreground + '"' + (this.Hotkey ? ' data-hotkey="' + this.Hotkey + '"' : '') + '>' + element + '</a>';
    },

    /**
     * fires the selection changed event
     * @this {Astriarch.PlanetView.ResearchTypeProgressCardListItem}
     */
    onClick: function() {
        Astriarch.ResearchControl.ResearchTypeProgressCardListItemClicked();
    },

    /**
     * fires the double click event
     * @this {Astriarch.PlanetView.ResearchTypeProgressCardListItem}
     */
    onDblClick: function() {

    }
});
