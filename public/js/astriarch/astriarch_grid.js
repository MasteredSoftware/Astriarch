var Astriarch = Astriarch || require('./astriarch_base');

/**
 * A Grid is the model of the playfield containing hexes
 * @constructor
 */
Astriarch.Grid = function(/*double*/ width, /*double*/ height) {
	this.Hexes = [];
	this.SelectedHex = null;
	//setup a dictionary for use later for assigning the Y CoOrd
	var HexagonsByXCoOrd = {}; //Dictionary<int, List<Hexagon>>

	var row = 0;
	for (var y = 0.0; y + Astriarch.Hexagon.Static.HEIGHT <= height; y += Astriarch.Hexagon.Static.HEIGHT / 2)
	{
		var col = 0;
		var colId = 0;

		var offset = 0.0;
		if (row % 2 == 1)
		{
			offset = (Astriarch.Hexagon.Static.WIDTH - Astriarch.Hexagon.Static.SIDE)/2 + Astriarch.Hexagon.Static.SIDE;;
			colId = 1;
		}
		
		for (var x = offset; x + Astriarch.Hexagon.Static.WIDTH <= width; x += Astriarch.Hexagon.Static.WIDTH + Astriarch.Hexagon.Static.SIDE)
		{
			var h = new Astriarch.Hexagon(Astriarch.Grid.Static.Letters[row] + (colId + 1), x, y);
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
	for (var x in HexagonsByXCoOrd)
	{
		var hexagonsByX = HexagonsByXCoOrd[x];
		var yCoOrd = Math.floor(x / 2) + (x % 2);
		for (var y in hexagonsByX)
		{
			var h = hexagonsByX[y];//Hexagon
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
	if (this.SelectedHex != null)
	{
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
	for (var h in this.Hexes)
	{
		if (this.Hexes[h].Contains(p))
		{
			return this.Hexes[h];
		}
	}

	return null;
};

Astriarch.Grid.prototype.ShowHexGrid = function() {
	//TODO: Implement
	//turn on the Stroke Brush for each Polygon

	for(var h in this.Hexes)
	{
		this.Hexes[h].Select();
	}

};

Astriarch.Grid.prototype.HideHexGrid = function() {
	//TODO: Implement
	//turn off the Stroke Brush for each Polygon
	/*
	foreach (Hexagon h in this.Hexes)
	{
		h.PolyBase.Stroke = null;
	}
	*/
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
