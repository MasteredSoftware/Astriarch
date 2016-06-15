var Astriarch = Astriarch || require('./astriarch_base');

var jCanvas = jCanvas || require('./../jCanvas');

/**
 * A Grid is the model of the playfield containing hexes
 * @constructor
 */
Astriarch.Grid = function(/*double*/ width, /*double*/ height, /*{systemsToGenerate:4, planetsPerSystem:4, galaxySize:1, distributePlanetsEvenly: true, "turnTimeLimitSeconds":0}*/ options) {

	this.Quadrants = [];//List<Rect>

	var h, x, y, quadWidth, quadHeight;
	x = 0;
	y = 0;
	quadWidth = width / 2;
	quadHeight = height / 2;
	if (options.SystemsToGenerate == 2 || options.SystemsToGenerate == 4) {
		//[0 , 0]
		this.Quadrants.push(new Astriarch.Grid.Rect(x, y, quadWidth, quadHeight));
		//[0 , 1]
		x = quadWidth;
		this.Quadrants.push(new Astriarch.Grid.Rect(x, y, quadWidth, quadHeight));
		//[1 , 1]
		y = quadHeight;
		this.Quadrants.push(new Astriarch.Grid.Rect(x, y, quadWidth, quadHeight));
		//[1 , 0]
		x = 0;
		this.Quadrants.push(new Astriarch.Grid.Rect(x, y, quadWidth, quadHeight));
	} else { //we're generating 3 systems in a triangle arrangement
		//[0 , 0]
		this.Quadrants.push(new Astriarch.Grid.Rect(x, y, quadWidth, quadHeight));
		//[0 , 1]
		x = quadWidth;
		this.Quadrants.push(new Astriarch.Grid.Rect(x, y, quadWidth, quadHeight));
		//[middle]
		x = quadWidth/2;
		y = quadHeight;
		this.Quadrants.push(new Astriarch.Grid.Rect(x, y, quadWidth, quadHeight));
	}


	//build sub-quadrants for each quadrant
	for (var q = 0; q < this.Quadrants.length; q++) {
		var r = this.Quadrants[q]; /*Rect*/

		var subWidth = r.Width / 2.0;
		var subHeight = r.Height / 2.0;
		//insert for the corner sub-quadrants
		//this will prefer this sub-quadrant for the home planet

		var r0Sub = new Astriarch.Grid.Rect(r.X, r.Y, subWidth, subHeight);
		r.Children.push(r0Sub);

		var r1Sub = new Astriarch.Grid.Rect(r.X + subWidth, r.Y, subWidth, subHeight);
		if (q == 1)
			r.Children.splice(0, 0, r1Sub);
		else
			r.Children.push(r1Sub);

		var r2Sub = new Astriarch.Grid.Rect(r.X + subWidth, r.Y + subHeight, subWidth, subHeight);
		if (q == 2)
			r.Children.splice(0, 0, r2Sub);
		else
			r.Children.push(r2Sub);

		var r3Sub = new Astriarch.Grid.Rect(r.X, r.Y + subHeight, subWidth, subHeight);
		if (q == 3)
			r.Children.splice(0, 0, r3Sub);
		else
			r.Children.push(r3Sub);
	}


	this.Hexes = [];
	this.SelectedHex = null;
	//setup a dictionary for use later for assigning the Y CoOrd
	var HexagonsByXCoOrd = {}; //Dictionary<int, List<Hexagon>>

	var galaxySizeMultiplier = Astriarch.Model.GalaxySizeOptionToHexSizeMultiplier(options.GalaxySize);

	var hexWidth = Astriarch.Hexagon.Static.WIDTH * galaxySizeMultiplier;
	var hexHeight = Astriarch.Hexagon.Static.HEIGHT * galaxySizeMultiplier;
	var hexSide = Astriarch.Hexagon.Static.SIDE * galaxySizeMultiplier;

	var row = 0;
	for (y = 0.0; y + hexHeight <= height; y += hexHeight / 2) {
		var col = 0;
		var colId = 0;

		var offset = 0.0;
		if (row % 2 == 1) {
			offset = (hexWidth - hexSide)/2 + hexSide;
			colId = 1;
		}
		
		for (x = offset; x + hexWidth <= width; x += hexWidth + hexSide) {
			h = new Astriarch.Hexagon(Astriarch.Grid.Static.Letters[row] + (colId + 1), x, y, hexWidth, hexHeight, hexSide);
			h.PathCoOrdX = colId;//the column is the x coordinate of the hex, for the y coordinate we need to get more fancy
			this.Hexes.push(h);
			
			if (!HexagonsByXCoOrd[colId])
				HexagonsByXCoOrd[colId] = [];
			HexagonsByXCoOrd[colId].push(h);

			col++;
			colId+=2;
		}
		row++;
	}

	//finally go through our list of hexagons by their x co-ordinate to assign the y co-ordinate
	for (x in HexagonsByXCoOrd) {
		var hexagonsByX = HexagonsByXCoOrd[x];
		var yCoOrd = Math.floor(x / 2) + (x % 2);
		for (y in hexagonsByX) {
			h = hexagonsByX[y];//Hexagon
			h.PathCoOrdY = yCoOrd++;
		}
	}
};

Astriarch.Grid.Static = {Letters:'ABCDEFGHIJKLMNOPQRSTUVWXYZ'};

/**
 * Sets a hex in the grid as selected
 * @this {Astriarch.Grid}
 */
Astriarch.Grid.prototype.SelectHex = function(/*Hexagon*/ h) {
	//deselect if we've got one selected
	if (this.SelectedHex != null) {
		this.SelectedHex.Deselect();
		this.SelectedHex = null;
	}

	h.Select();
	this.SelectedHex = h;
};

/**
 * Returns a hex at a given point
 * @this {Astriarch.Grid}
 * @return {Astriarch.Hexagon}
 */
Astriarch.Grid.prototype.GetHexAt = function(/*Point*/ p) {
	//find the hex that contains this point
	for (var h in this.Hexes) {
		if (this.Hexes[h].Contains(p)) {
			return this.Hexes[h];
		}
	}

	return null;
};

Astriarch.Grid.prototype.ShowHexGrid = function() {
	//turn on the Stroke Brush for each Polygon

	for(var h in this.Hexes) {
		this.Hexes[h].Select();
	}

};

Astriarch.Grid.prototype.HideHexGrid = function() {
	//turn off the Stroke Brush for each Polygon

	for(var h in this.Hexes) {
		this.Hexes[h].Deselect();
	}

};

/**
 * Returns a distance between two hexes
 * @this {Astriarch.Grid}
 * @return {number}
 */
Astriarch.Grid.prototype.GetHexDistance = function(/*Hexagon*/ h1, /*Hexagon*/ h2) {
	//a good explanation of this calc can be found here:
	//http://playtechs.blogspot.com/2007/04/hex-grids.html
	var deltaX = h1.PathCoOrdX - h2.PathCoOrdX;
	var deltaY = h1.PathCoOrdY - h2.PathCoOrdY;
	return ((Math.abs(deltaX) + Math.abs(deltaY) + Math.abs(deltaX - deltaY)) / 2);
};


/**
 * Rect is another rectangle
 * @constructor
 */
Astriarch.Grid.Rect = function(x, y, width, height) {
	this.X = x;
	this.Y = y;
	this.Width = width;
	this.Height = height;

	this.Left = x;
	this.Right = x + width;
	this.Top = y;
	this.Bottom = y + height;

	this.Children = [];//This allows for sub-rectangles
};

/**
 * Contains for rect
 * @this {Astriarch.Grid.Rect}
 * @param {Astriarch.Point} point the test point
 */
Astriarch.Grid.Rect.prototype.Contains = function(/*Astriarch.Point*/ point) {
	if(this.Left < point.X && this.Right > point.X &&
		this.Bottom > point.Y && this.Top < point.Y)
		return true;
	else
		return false;
};

/**
 * A Drawn version of Astriarch.Grid.Rect mostly for debugging quadrants and subquadrants
 * @constructor
 */
Astriarch.Grid.DrawnRect = jCanvas.DrawnObject.extend({ // Astriarch.Grid.Rect drawn object class

	/**
	 * initializes this Hexagon
	 * @this {Astriarch.Grid.DrawnRect}
	 */
	init: function (r) {
		this.Rect = r;//Astriarch.Grid.Rect

		this.selected = false;

	},

	/**
	 * draws this Hexagon to the canvas
	 * @this {Astriarch.Grid.DrawnRect}
	 */
	draw: function (ctx) {

		if (this.selected) {
			ctx.strokeStyle = "blue";
			ctx.lineWidth = 1;
			ctx.rect(this.Rect.X, this.Rect.Y, this.Rect.Width, this.Rect.Height);
			ctx.stroke();
			this.Rect.Children.forEach(function(r){
				ctx.strokeStyle = "purple";
				ctx.lineWidth = 1;
				ctx.rect(r.X, r.Y, r.Width, r.Height);
				ctx.stroke();
			});
		}

	}
});
