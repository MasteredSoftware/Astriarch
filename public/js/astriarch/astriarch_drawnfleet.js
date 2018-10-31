/**
 * A DrawnFleet is a graphical representation of a fleet
 * @constructor
 */
Astriarch.DrawnFleet = jCanvas.DrawnObject.extend({
  // drawn object class

  /**
   * initializes this DrawnFleet
   * @this {Astriarch.DrawnFleet}
   */
  init: function(/*Fleet*/ f) {
    this.Fleet = f;
    this.Fleet.DrawnFleet = this; //setup backreference

    //public TextBlock TravelETATextBlock = new TextBlock();
    this.TravelETATextBlockRect = new Astriarch.Rectangle();
    this.TravelETATextBlockText = "ETA";

    this.travelDistancePoint = new Astriarch.Point();

    //setup visual elements
    this.TravelFleetRect = new Astriarch.Rectangle();
    this.TravelFleetRect.Height = 11;
    this.TravelFleetRect.Width = 11;

    this.TravelLine = new Astriarch.Line();
  },

  /**
   * Draws this DrawnFleet to the canvas
   * @this {Astriarch.DrawnFleet}
   */
  draw: function(ctx) {
    if (this.Fleet.totalTravelDistance > 0) {
      var color = "green";
      var fleetRectangleImageData = Astriarch.Util.starshipImageData;
      if (this.Fleet.Owner) {
        color = this.Fleet.Owner.Color.toString();
        fleetRectangleImageData = Astriarch.Util.GetImageData(this.Fleet.Owner.Color).starshipImageData;
      }
      //draw travel line
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.TravelLine.X1, this.TravelLine.Y1);
      ctx.lineTo(this.TravelLine.X2, this.TravelLine.Y2);
      ctx.closePath();
      ctx.stroke();

      //draw fleet image
      var fleetImg = ctx.createImageData(this.TravelFleetRect.Width, this.TravelFleetRect.Height);
      for (var i in fleetRectangleImageData) fleetImg.data[i] = fleetRectangleImageData[i];
      ctx.putImageData(fleetImg, this.TravelFleetRect.X, this.TravelFleetRect.Y);

      //draw ETA text
      ctx.fillStyle = color;
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      //var textWidth = ctx.measureText(this.Planet.BoundingHex.Id);
      ctx.fillText(this.TravelETATextBlockText, this.TravelETATextBlockRect.X, this.TravelETATextBlockRect.Y);
    }
  },

  /**
   * returns false because we never need hit testing for the drawn fleet
   * @return {boolean}
   */
  isInBounds: function(x, y) {
    return false;
  },

  //TODO: need to actually draw on the proper canvas context, or update the fleet's model and have the view or some controller handle the painting
  /**
   * Updates the DrawnFleet destination travel line on the canvas
   * @this {Astriarch.DrawnFleet}
   */
  updateTravelLine: function() {
    if (this.Fleet.ParsecsToDestination >= 0) {
      //draw the line
      this.TravelLine.X2 = this.Fleet.DestinationHex.MidPoint.X;
      this.TravelLine.Y2 = this.Fleet.DestinationHex.MidPoint.Y;

      var traveled =
        ((this.Fleet.totalTravelDistance - this.Fleet.ParsecsToDestination) * 1.0) /
        (this.Fleet.totalTravelDistance * 1.0);

      this.travelDistancePoint.X =
        this.Fleet.travelingFromHex.MidPoint.X -
        (this.Fleet.travelingFromHex.MidPoint.X - this.TravelLine.X2) * traveled;
      this.travelDistancePoint.Y =
        this.Fleet.travelingFromHex.MidPoint.Y -
        (this.Fleet.travelingFromHex.MidPoint.Y - this.TravelLine.Y2) * traveled;

      this.TravelLine.X1 = this.travelDistancePoint.X;
      this.TravelLine.Y1 = this.travelDistancePoint.Y;

      var turns = Math.ceil(this.Fleet.GetTurnsToDestination());
      var turnText = turns > 1 ? " Turns" : " Turn";
      this.TravelETATextBlockText = turns + turnText;

      var offsetX = 8;
      //if the travel line points from left to right, we will instead show the TravelETATextBlock to the left of the ship indicator
      if (this.TravelLine.X2 > this.Fleet.travelingFromHex.MidPoint.X) {
        if (turns > 9) offsetX = -40;
        else if (turns == 1) offsetX = -30;
        else offsetX = -35;
      }

      this.TravelETATextBlockRect.X = this.travelDistancePoint.X + offsetX;
      this.TravelETATextBlockRect.Y = this.travelDistancePoint.Y + 4;

      this.TravelFleetRect.X = this.travelDistancePoint.X - 5;
      this.TravelFleetRect.Y = this.travelDistancePoint.Y - 5;
    } else {
      this.Fleet.totalTravelDistance = 0;
    }
    if (this.layer) this.layer.needsDisplay = true; //set dirty flag
  }
});
