/**
 * A tiny stand-in for Konva's node tree, for unit tests that only need to see
 * which nodes exist and in what order. Konva's Node build needs the native
 * `canvas` package, so specs mock 'konva' with this instead:
 *
 *   vi.mock('konva', async () => ({ default: (await import('./testing/fakeKonva')).FakeKonva }));
 *
 * Child order models Konva's z-order: a parent draws its children in order, so
 * moveToTop() moves a node to the end of its parent's children. Any attribute
 * method that isn't defined here (x(), fill(), visible(), text(), ...) works as
 * a Konva-style getter/setter on `attrs`, returning the node when setting.
 */
export class FakeNode {
	static created = 0;
	static destroyed = 0;

	static resetCounts(): void {
		FakeNode.created = 0;
		FakeNode.destroyed = 0;
	}

	readonly kind: string;
	attrs: Record<string, unknown>;
	children: FakeNode[] = [];
	parent: FakeNode | null = null;
	isDestroyed = false;

	constructor(attrs: Record<string, unknown> = {}) {
		this.kind = new.target.name;
		this.attrs = { ...attrs };
		FakeNode.created++;
		return new Proxy(this, {
			get(target, prop, receiver) {
				if (typeof prop === 'symbol' || prop in target) {
					return Reflect.get(target, prop, receiver);
				}
				// Konva-style attribute accessor
				return (...args: unknown[]) => {
					if (args.length === 0) return target.attrs[prop];
					target.attrs[prop] = args[0];
					return receiver;
				};
			}
		});
	}

	add(...children: FakeNode[]): this {
		for (const child of children) {
			child.remove();
			child.parent = this;
			this.children.push(child);
		}
		return this;
	}

	remove(): this {
		if (this.parent) {
			const siblings = this.parent.children;
			siblings.splice(siblings.indexOf(this), 1);
			this.parent = null;
		}
		return this;
	}

	destroyChildren(): this {
		for (const child of [...this.children]) child.destroy();
		return this;
	}

	destroy(): this {
		if (this.isDestroyed) return this;
		this.destroyChildren();
		this.remove();
		this.isDestroyed = true;
		FakeNode.destroyed++;
		return this;
	}

	private moveTo(index: number): this {
		if (!this.parent) return this;
		const siblings = this.parent.children;
		siblings.splice(siblings.indexOf(this), 1);
		siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
		return this;
	}

	moveToTop(): this {
		return this.moveTo(Infinity);
	}

	moveToBottom(): this {
		return this.moveTo(0);
	}

	moveUp(): this {
		return this.moveTo(this.zIndex() + 1);
	}

	zIndex(): number {
		return this.parent ? this.parent.children.indexOf(this) : 0;
	}

	setAttr(key: string, value: unknown): this {
		this.attrs[key] = value;
		return this;
	}

	getAttr(key: string): unknown {
		return this.attrs[key];
	}
}

export class Group extends FakeNode {}
export class Text extends FakeNode {}
export class Circle extends FakeNode {}
export class Path extends FakeNode {}
export class Image extends FakeNode {}
export class Line extends FakeNode {}

export const FakeKonva = { Group, Text, Circle, Path, Image, Line };
