import Konva from 'konva';

export enum TravelLineType {
	FLEET_IN_TRANSIT = 'fleet_in_transit',
	WAYPOINT = 'waypoint',
	PROSPECTIVE = 'prospective'
}

export interface TravelLineOptions {
	type: TravelLineType;
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	color?: string;
	alpha?: number;
	zIndex?: number;
}

export class DrawnTravelLine {
	public group: Konva.Group;
	private line!: Konva.Line;
	private type: TravelLineType;
	private fromPoint: { x: number; y: number };
	private toPoint: { x: number; y: number };

	constructor(options: TravelLineOptions) {
		this.group = new Konva.Group({ perfectDrawEnabled: false });
		this.type = options.type;
		this.fromPoint = { x: options.fromX, y: options.fromY };
		this.toPoint = { x: options.toX, y: options.toY };

		this.createLine();
		this.applyStyle(options.color, options.alpha);
		this.updatePoints();

		if (options.zIndex !== undefined) {
			this.group.zIndex(options.zIndex);
		}
	}

	private createLine() {
		this.line = new Konva.Line({
			points: [0, 0, 0, 0],
			stroke: '#00FFFF',
			strokeWidth: 1,
			lineCap: 'round',
			lineJoin: 'round',
			perfectDrawEnabled: false,
			shadowForStrokeEnabled: false,
			listening: false // Disable events
		});

		this.group.add(this.line);
	}

	private applyStyle(customColor?: string, customAlpha?: number) {
		let color: string;
		let strokeWidth: number;
		let dash: number[] | undefined;
		let alpha: number;

		switch (this.type) {
			case TravelLineType.FLEET_IN_TRANSIT:
				color = customColor || '#00FFFF'; // Cyan
				strokeWidth = 1;
				dash = undefined; // Solid line
				alpha = customAlpha !== undefined ? customAlpha : 0.8;
				break;

			case TravelLineType.WAYPOINT:
				color = customColor || '#FFFF00'; // Yellow
				strokeWidth = 1;
				dash = [4, 4]; // Dashed line like the original game
				alpha = customAlpha !== undefined ? customAlpha : 0.6;
				break;

			case TravelLineType.PROSPECTIVE:
				color = customColor || '#00FF00'; // Green
				strokeWidth = 2;
				dash = [8, 4]; // Longer dashes for better visibility
				alpha = customAlpha !== undefined ? customAlpha : 0.9;
				break;

			default:
				color = '#FFFFFF';
				strokeWidth = 1;
				dash = undefined;
				alpha = 0.5;
		}

		this.line.stroke(color);
		this.line.strokeWidth(strokeWidth);
		this.line.dash(dash);
		this.line.opacity(alpha);

		// Add glow effect for prospective lines to make them more prominent
		if (this.type === TravelLineType.PROSPECTIVE) {
			this.line.shadowColor(color);
			this.line.shadowBlur(3);
			this.line.shadowOpacity(0.5);
		} else {
			this.line.shadowBlur(0);
		}
	}

	private updatePoints() {
		this.line.points([this.fromPoint.x, this.fromPoint.y, this.toPoint.x, this.toPoint.y]);
	}

	/**
	 * Update the travel line endpoints
	 */
	public updateEndpoints(fromX: number, fromY: number, toX: number, toY: number) {
		this.fromPoint = { x: fromX, y: fromY };
		this.toPoint = { x: toX, y: toY };
		this.updatePoints();
	}

	/**
	 * Update the travel line style with custom color and alpha
	 */
	public updateStyleCustom(color?: string, alpha?: number) {
		this.applyStyle(color, alpha);
	}

	/**
	 * Change the type of travel line (updates styling automatically)
	 */
	public setType(type: TravelLineType, color?: string, alpha?: number) {
		this.type = type;
		this.applyStyle(color, alpha);
	}

	/**
	 * Show the travel line
	 */
	public show() {
		this.group.visible(true);
	}

	/**
	 * Hide the travel line
	 */
	public hide() {
		this.group.visible(false);
	}

	/**
	 * Check if the travel line is currently visible
	 */
	public isVisible(): boolean {
		return this.group.visible();
	}

	/**
	 * Get the current type of the travel line
	 */
	public getType(): TravelLineType {
		return this.type;
	}

	/**
	 * Get the current endpoints
	 */
	public getEndpoints() {
		return {
			from: { ...this.fromPoint },
			to: { ...this.toPoint }
		};
	}

	/**
	 * Animate the line drawing from start to end
	 */
	public animateIn(duration: number = 0.5) {
		// Start with no length
		this.line.points([this.fromPoint.x, this.fromPoint.y, this.fromPoint.x, this.fromPoint.y]);
		this.show();

		// Animate to full length
		this.line.to({
			points: [this.fromPoint.x, this.fromPoint.y, this.toPoint.x, this.toPoint.y],
			duration: duration,
			easing: Konva.Easings.EaseOut
		});
	}

	/**
	 * Animate the line disappearing
	 */
	public animateOut(duration: number = 0.3): Promise<void> {
		return new Promise((resolve) => {
			this.line.to({
				opacity: 0,
				duration: duration,
				easing: Konva.Easings.EaseIn,
				onFinish: () => {
					this.hide();
					// Restore opacity for future use
					this.line.opacity(
						this.type === TravelLineType.WAYPOINT
							? 0.6
							: this.type === TravelLineType.PROSPECTIVE
								? 0.9
								: 0.8
					);
					resolve();
				}
			});
		});
	}

	/**
	 * Clean up the travel line
	 */
	public destroy() {
		this.group.destroyChildren();
		this.group.destroy();
	}
}
