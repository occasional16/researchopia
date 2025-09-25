"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _eventEmitter = require("event-emitter");

var _eventEmitter2 = _interopRequireDefault(_eventEmitter);

var _core = require("../../utils/core");

var _epubcfi = require("../../epubcfi");

var _epubcfi2 = _interopRequireDefault(_epubcfi);

var _contents = require("../../contents");

var _contents2 = _interopRequireDefault(_contents);

var _constants = require("../../utils/constants");

var _marksPane = require("marks-pane");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var IframeView = function () {
	function IframeView(section, options) {
		_classCallCheck(this, IframeView);

		this.settings = (0, _core.extend)({
			ignoreClass: "",
			axis: options.layout && options.layout.props.flow === "scrolled" ? "vertical" : "horizontal",
			direction: undefined,
			width: 0,
			height: 0,
			layout: undefined,
			globalLayoutProperties: {},
			method: undefined,
			useSnapPoints: false
		}, options || {});

		this.id = "epubjs-view-" + (0, _core.uuid)();
		this.section = section;
		this.index = section.index;

		this.element = this.container(this.settings.axis);

		this.added = false;
		this.displayed = false;
		this.rendered = false;

		// this.width  = this.settings.width;
		// this.height = this.settings.height;

		this.fixedWidth = 0;
		this.fixedHeight = 0;

		// Blank Cfi for Parsing
		this.epubcfi = new _epubcfi2.default();

		this.layout = this.settings.layout;
		// Dom events to listen for
		// this.listenedEvents = ["keydown", "keyup", "keypressed", "mouseup", "mousedown", "click", "touchend", "touchstart"];

		this.pane = undefined;
		this.highlights = {};
		this.underlines = {};
		this.marks = {};
	}

	_createClass(IframeView, [{
		key: "container",
		value: function container(axis) {
			var element = document.createElement("div");

			element.classList.add("epub-view");

			// this.element.style.minHeight = "100px";
			element.style.height = "0px";
			element.style.width = "0px";
			// element.style.overflow = "hidden";
			element.style.position = "relative";
			element.style.display = "block";

			if (axis && axis == "horizontal") {
				element.style.flex = "none";
			} else {
				element.style.flex = "initial";
			}

			return element;
		}
	}, {
		key: "create",
		value: function create() {

			if (this.iframe) {
				return this.iframe;
			}

			if (!this.element) {
				this.element = this.container();
			}

			this.iframe = document.createElement("iframe");
			this.iframe.id = this.id;
			this.iframe.scrolling = "no"; // Might need to be removed: breaks ios width calculations
			this.iframe.style.overflow = "hidden";
			this.iframe.seamless = "seamless";
			// Back up if seamless isn't supported
			this.iframe.style.border = "none";

			this.iframe.style.position = "absolute";
			this.iframe.style.top = "0";
			this.iframe.style.left = "0";

			this.iframe.setAttribute("enable-annotation", "true");

			this.resizing = true;

			// this.iframe.style.display = "none";
			this.element.style.visibility = this.shown ? "visible" : "hidden";
			this.iframe.style.visibility = this.shown ? "visible" : "hidden";

			this.iframe.style.width = "0";
			this.iframe.style.height = "0";
			this._width = 0;
			this._height = 0;

			this.element.setAttribute("ref", this.index);

			this.element.appendChild(this.iframe);
			this.added = true;

			this.elementBounds = (0, _core.bounds)(this.element);

			// if(width || height){
			//   this.resize(width, height);
			// } else if(this.width && this.height){
			//   this.resize(this.width, this.height);
			// } else {
			//   this.iframeBounds = bounds(this.iframe);
			// }


			if ("srcdoc" in this.iframe) {
				this.supportsSrcdoc = true;
			} else {
				this.supportsSrcdoc = false;
			}

			if (!this.settings.method) {
				this.settings.method = this.supportsSrcdoc ? "srcdoc" : "write";
			}

			return this.iframe;
		}
	}, {
		key: "render",
		value: function render(request, show) {

			// view.onLayout = this.layout.format.bind(this.layout);
			this.create();

			// Fit to size of the container, apply padding
			this.size();

			if (!this.sectionRender) {
				this.sectionRender = this.section.render(request);
			}

			// Render Chain
			return this.sectionRender.then(function (contents) {
				return this.load(contents);
			}.bind(this)).then(function () {
				var _this = this;

				// apply the layout function to the contents
				this.layout.format(this.contents);

				// find and report the writingMode axis
				var writingMode = this.contents.writingMode();
				var axis = writingMode.indexOf("vertical") === 0 ? "vertical" : "horizontal";

				this.setAxis(axis);
				this.emit(_constants.EVENTS.VIEWS.AXIS, axis);

				// Listen for events that require an expansion of the iframe
				this.addListeners();

				return new Promise(function (resolve, reject) {
					// Expand the iframe to the full size of the content
					_this.expand();
					resolve();
				});
			}.bind(this), function (e) {
				this.emit(_constants.EVENTS.VIEWS.LOAD_ERROR, e);
				return new Promise(function (resolve, reject) {
					reject(e);
				});
			}.bind(this)).then(function () {
				this.emit(_constants.EVENTS.VIEWS.RENDERED, this.section);
			}.bind(this));
		}
	}, {
		key: "reset",
		value: function reset() {
			if (this.iframe) {
				this.iframe.style.width = "0";
				this.iframe.style.height = "0";
				this._width = 0;
				this._height = 0;
				this._textWidth = undefined;
				this._contentWidth = undefined;
				this._textHeight = undefined;
				this._contentHeight = undefined;
			}
			this._needsReframe = true;
		}

		// Determine locks base on settings

	}, {
		key: "size",
		value: function size(_width, _height) {
			var width = _width || this.settings.width;
			var height = _height || this.settings.height;

			if (this.layout.name === "pre-paginated") {
				this.lock("both", width, height);
			} else if (this.settings.axis === "horizontal") {
				this.lock("height", width, height);
			} else {
				this.lock("width", width, height);
			}

			this.settings.width = width;
			this.settings.height = height;
		}

		// Lock an axis to element dimensions, taking borders into account

	}, {
		key: "lock",
		value: function lock(what, width, height) {
			var elBorders = (0, _core.borders)(this.element);
			var iframeBorders;

			if (this.iframe) {
				iframeBorders = (0, _core.borders)(this.iframe);
			} else {
				iframeBorders = { width: 0, height: 0 };
			}

			if (what == "width" && (0, _core.isNumber)(width)) {
				this.lockedWidth = width - elBorders.width - iframeBorders.width;
				// this.resize(this.lockedWidth, width); //  width keeps ratio correct
			}

			if (what == "height" && (0, _core.isNumber)(height)) {
				this.lockedHeight = height - elBorders.height - iframeBorders.height;
				// this.resize(width, this.lockedHeight);
			}

			if (what === "both" && (0, _core.isNumber)(width) && (0, _core.isNumber)(height)) {

				this.lockedWidth = width - elBorders.width - iframeBorders.width;
				this.lockedHeight = height - elBorders.height - iframeBorders.height;
				// this.resize(this.lockedWidth, this.lockedHeight);
			}

			if (this.displayed && this.iframe) {

				// this.contents.layout();
				this.expand();
			}
		}

		// Resize a single axis based on content dimensions

	}, {
		key: "expand",
		value: function expand(force) {
			var _this2 = this;

			var width = this.lockedWidth;
			var height = this.lockedHeight;
			var columns;

			var textWidth, textHeight;

			if (!this.iframe || this._expanding) return;

			this._expanding = true;

			this.stable(false);

			if (this.layout.name === "pre-paginated") {
				width = this.layout.columnWidth;
				height = this.layout.height;
			}
			// Expand Horizontally
			else if (this.settings.axis === "horizontal") {
					// Get the width of the text
					width = this.contents.textWidth();

					if (width % this.layout.pageWidth > 0) {
						width = Math.ceil(width / this.layout.pageWidth) * this.layout.pageWidth;
					}

					if (this.settings.forceEvenPages) {
						columns = width / this.layout.pageWidth;
						if (this.layout.divisor > 1 && this.layout.name === "reflowable" && columns % 2 > 0) {
							// add a blank page
							console.log("add black");
							width += this.layout.pageWidth;
						}
					}
				} // Expand Vertically
				else if (this.settings.axis === "vertical") {
						height = this.contents.textHeight();
					}

			// Only Resize if dimensions have changed or
			// if Frame is still hidden, so needs reframing
			if (this._needsReframe || width != this._width || height != this._height) {
				this.reframe(width, height);
			}

			this._expanding = false;

			clearTimeout(this._stableTimeout);
			this._stableTimeout = setTimeout(function () {
				_this2.stable(true);
			}, 200);
		}
	}, {
		key: "reframe",
		value: function reframe(width, height) {
			var _this3 = this;

			var size;

			if (this.settings.useSnapPoints && this.settings.layout.props.flow === "paginated") {
				this.addSnapPoints(width);
			}

			if ((0, _core.isNumber)(width)) {
				this.element.style.width = width + "px";
				this.iframe.style.width = width + "px";
				this._width = width;
			}

			if ((0, _core.isNumber)(height)) {
				this.element.style.height = height + "px";
				this.iframe.style.height = height + "px";
				this._height = height;
			}

			var widthDelta = this.prevBounds ? width - this.prevBounds.width : width;
			var heightDelta = this.prevBounds ? height - this.prevBounds.height : height;

			size = {
				width: width,
				height: height,
				widthDelta: widthDelta,
				heightDelta: heightDelta
			};

			this.pane && this.pane.render();

			requestAnimationFrame(function () {
				var mark = void 0;
				for (var m in _this3.marks) {
					if (_this3.marks.hasOwnProperty(m)) {
						mark = _this3.marks[m];
						_this3.placeMark(mark.element, mark.range);
					}
				}
			});

			this.onResize(this, size);

			this.emit(_constants.EVENTS.VIEWS.RESIZED, size);

			this.prevBounds = size;

			this.elementBounds = (0, _core.bounds)(this.element);
		}
	}, {
		key: "load",
		value: function load(contents) {
			var loading = new _core.defer();
			var loaded = loading.promise;

			if (!this.iframe) {
				loading.reject(new Error("No Iframe Available"));
				return loaded;
			}

			this.iframe.onload = function (event) {

				this.onLoad(event, loading);
			}.bind(this);

			if (this.settings.method === "blobUrl") {
				this.blobUrl = (0, _core.createBlobUrl)(contents, "application/xhtml+xml");
				this.iframe.src = this.blobUrl;
			} else if (this.settings.method === "srcdoc") {
				this.iframe.srcdoc = contents;
			} else {

				this.document = this.iframe.contentDocument;

				if (!this.document) {
					loading.reject(new Error("No Document Available"));
					return loaded;
				}

				this.iframe.contentDocument.open();
				this.iframe.contentDocument.write(contents);
				this.iframe.contentDocument.close();
			}

			return loaded;
		}
	}, {
		key: "onLoad",
		value: function onLoad(event, promise) {
			var _this4 = this;

			this.window = this.iframe.contentWindow;
			this.document = this.iframe.contentDocument;

			this.contents = new _contents2.default(this.document, this.document.body, this.section.cfiBase, this.section.index);

			this.rendering = false;

			var link = this.document.querySelector("link[rel='canonical']");
			if (link) {
				link.setAttribute("href", this.section.canonical);
			} else {
				link = this.document.createElement("link");
				link.setAttribute("rel", "canonical");
				link.setAttribute("href", this.section.canonical);
				this.document.querySelector("head").appendChild(link);
			}

			this.contents.on(_constants.EVENTS.CONTENTS.EXPAND, function () {
				if (_this4.displayed && _this4.iframe) {
					_this4.expand();
					if (_this4.contents) {
						_this4.layout.format(_this4.contents);
					}
				}
			});

			this.contents.on(_constants.EVENTS.CONTENTS.RESIZE, function (e) {
				if (_this4.displayed && _this4.iframe) {
					_this4.expand();
					if (_this4.contents) {
						_this4.layout.format(_this4.contents);
					}
				}
			});

			promise.resolve(this.contents);
		}
	}, {
		key: "setLayout",
		value: function setLayout(layout) {
			this.layout = layout;

			if (this.contents) {
				this.layout.format(this.contents);
				this.expand();
			}
		}
	}, {
		key: "setAxis",
		value: function setAxis(axis) {

			// Force vertical for scrolled
			if (this.layout.props.flow === "scrolled") {
				axis = "vertical";
			}

			this.settings.axis = axis;

			if (axis == "horizontal") {
				this.element.style.flex = "none";
			} else {
				this.element.style.flex = "initial";
			}

			this.size();
		}
	}, {
		key: "addListeners",
		value: function addListeners() {
			//TODO: Add content listeners for expanding
		}
	}, {
		key: "removeListeners",
		value: function removeListeners(layoutFunc) {
			//TODO: remove content listeners for expanding
		}
	}, {
		key: "display",
		value: function display(request) {
			var displayed = new _core.defer();

			if (!this.displayed) {

				this.render(request).then(function () {

					this.emit(_constants.EVENTS.VIEWS.DISPLAYED, this);
					this.onDisplayed(this);

					this.displayed = true;
					displayed.resolve(this);
				}.bind(this), function (err) {
					displayed.reject(err, this);
				});
			} else {
				displayed.resolve(this);
			}

			return displayed.promise;
		}
	}, {
		key: "show",
		value: function show() {

			if (this.shown === true) {
				return;
			}

			this.element.style.visibility = "visible";

			if (this.iframe) {
				this.iframe.style.visibility = "visible";

				// Remind Safari to redraw the iframe
				this.iframe.style.transform = "translateZ(0)";
				this.iframe.offsetWidth;
				this.iframe.style.transform = null;

				this.shown = true;
			}

			this.emit(_constants.EVENTS.VIEWS.SHOWN, this);
		}
	}, {
		key: "hide",
		value: function hide() {
			// this.iframe.style.display = "none";
			if (this.shown !== false) {
				return;
			}

			this.shown = false;

			this.element.style.visibility = "hidden";
			this.iframe.style.visibility = "hidden";

			this.stopExpanding = true;
			this.emit(_constants.EVENTS.VIEWS.HIDDEN, this);
		}
	}, {
		key: "offset",
		value: function offset() {
			return {
				top: this.element.offsetTop,
				left: this.element.offsetLeft
			};
		}
	}, {
		key: "width",
		value: function width() {
			return this._width;
		}
	}, {
		key: "height",
		value: function height() {
			return this._height;
		}
	}, {
		key: "position",
		value: function position() {
			return this.element.getBoundingClientRect();
		}
	}, {
		key: "locationOf",
		value: function locationOf(target) {
			var parentPos = this.iframe.getBoundingClientRect();
			var targetPos = this.contents.locationOf(target, this.settings.ignoreClass);

			return {
				"left": targetPos.left,
				"top": targetPos.top
			};
		}
	}, {
		key: "onDisplayed",
		value: function onDisplayed(view) {
			// Stub, override with a custom functions
		}
	}, {
		key: "onResize",
		value: function onResize(view, e) {
			// Stub, override with a custom functions
		}
	}, {
		key: "bounds",
		value: function bounds(force) {
			if (force || !this.elementBounds) {
				this.elementBounds = (0, _core.bounds)(this.element);
			}

			return this.elementBounds;
		}
	}, {
		key: "highlight",
		value: function highlight(cfiRange) {
			var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
			var cb = arguments[2];

			var _this5 = this;

			var className = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "epubjs-hl";
			var styles = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

			if (!this.contents) {
				return;
			}
			var attributes = Object.assign({ "fill": "yellow", "fill-opacity": "0.3", "mix-blend-mode": "multiply" }, styles);
			var range = this.contents.range(cfiRange);

			var emitter = function emitter() {
				_this5.emit(_constants.EVENTS.VIEWS.MARK_CLICKED, cfiRange, data);
			};

			data["epubcfi"] = cfiRange;

			if (!this.pane) {
				this.pane = new _marksPane.Pane(this.iframe, this.element);
			}

			var m = new _marksPane.Highlight(range, className, data, attributes);
			var h = this.pane.addMark(m);

			this.highlights[cfiRange] = { "mark": h, "element": h.element, "listeners": [emitter, cb] };

			h.element.setAttribute("ref", className);
			h.element.addEventListener("click", emitter);
			h.element.addEventListener("touchstart", emitter);

			if (cb) {
				h.element.addEventListener("click", cb);
				h.element.addEventListener("touchstart", cb);
			}
			return h;
		}
	}, {
		key: "underline",
		value: function underline(cfiRange) {
			var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
			var cb = arguments[2];

			var _this6 = this;

			var className = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "epubjs-ul";
			var styles = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

			if (!this.contents) {
				return;
			}
			var attributes = Object.assign({ "stroke": "black", "stroke-opacity": "0.3", "mix-blend-mode": "multiply" }, styles);
			var range = this.contents.range(cfiRange);
			var emitter = function emitter() {
				_this6.emit(_constants.EVENTS.VIEWS.MARK_CLICKED, cfiRange, data);
			};

			data["epubcfi"] = cfiRange;

			if (!this.pane) {
				this.pane = new _marksPane.Pane(this.iframe, this.element);
			}

			var m = new _marksPane.Underline(range, className, data, attributes);
			var h = this.pane.addMark(m);

			this.underlines[cfiRange] = { "mark": h, "element": h.element, "listeners": [emitter, cb] };

			h.element.setAttribute("ref", className);
			h.element.addEventListener("click", emitter);
			h.element.addEventListener("touchstart", emitter);

			if (cb) {
				h.element.addEventListener("click", cb);
				h.element.addEventListener("touchstart", cb);
			}
			return h;
		}
	}, {
		key: "mark",
		value: function mark(cfiRange) {
			var _this7 = this;

			var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
			var cb = arguments[2];


			if (!this.contents) {
				return;
			}

			if (cfiRange in this.marks) {
				var item = this.marks[cfiRange];
				return item;
			}

			var range = this.contents.range(cfiRange);
			if (!range) {
				return;
			}
			var container = range.commonAncestorContainer;
			var parent = container.nodeType === 1 ? container : container.parentNode;

			var emitter = function emitter(e) {
				_this7.emit(_constants.EVENTS.VIEWS.MARK_CLICKED, cfiRange, data);
			};

			if (range.collapsed && container.nodeType === 1) {
				range = new Range();
				range.selectNodeContents(container);
			} else if (range.collapsed) {
				// Webkit doesn't like collapsed ranges
				range = new Range();
				range.selectNodeContents(parent);
			}

			var mark = this.document.createElement("a");
			mark.setAttribute("ref", "epubjs-mk");
			mark.style.position = "absolute";

			mark.dataset["epubcfi"] = cfiRange;

			if (data) {
				Object.keys(data).forEach(function (key) {
					mark.dataset[key] = data[key];
				});
			}

			if (cb) {
				mark.addEventListener("click", cb);
				mark.addEventListener("touchstart", cb);
			}

			mark.addEventListener("click", emitter);
			mark.addEventListener("touchstart", emitter);

			this.placeMark(mark, range);

			this.element.appendChild(mark);

			this.marks[cfiRange] = { "element": mark, "range": range, "listeners": [emitter, cb] };

			return parent;
		}
	}, {
		key: "placeMark",
		value: function placeMark(element, range) {
			var top = void 0,
			    right = void 0,
			    left = void 0;

			if (this.layout.name === "pre-paginated" || this.settings.axis !== "horizontal") {
				var pos = range.getBoundingClientRect();
				top = pos.top;
				right = pos.right;
			} else {
				// Element might break columns, so find the left most element
				var rects = range.getClientRects();

				var rect = void 0;
				for (var i = 0; i != rects.length; i++) {
					rect = rects[i];
					if (!left || rect.left < left) {
						left = rect.left;
						right = left + this.layout.columnWidth - this.layout.gap;
						top = rect.top;
					}
				}
			}

			element.style.top = top + "px";
			element.style.left = right + "px";
		}
	}, {
		key: "unhighlight",
		value: function unhighlight(cfiRange) {
			var item = void 0;
			if (cfiRange in this.highlights) {
				item = this.highlights[cfiRange];

				this.pane.removeMark(item.mark);
				item.listeners.forEach(function (l) {
					if (l) {
						item.element.removeEventListener("click", l);
					};
				});
				delete this.highlights[cfiRange];
			}
		}
	}, {
		key: "ununderline",
		value: function ununderline(cfiRange) {
			var item = void 0;
			if (cfiRange in this.underlines) {
				item = this.underlines[cfiRange];
				this.pane.removeMark(item.mark);
				item.listeners.forEach(function (l) {
					if (l) {
						item.element.removeEventListener("click", l);
					};
				});
				delete this.underlines[cfiRange];
			}
		}
	}, {
		key: "unmark",
		value: function unmark(cfiRange) {
			var item = void 0;
			if (cfiRange in this.marks) {
				item = this.marks[cfiRange];
				this.element.removeChild(item.element);
				item.listeners.forEach(function (l) {
					if (l) {
						item.element.removeEventListener("click", l);
					};
				});
				delete this.marks[cfiRange];
			}
		}

		// Add divs for snapping

	}, {
		key: "addSnapPoints",
		value: function addSnapPoints(width) {
			var pages = width / this.layout.pageWidth;

			this.clearSnapPoints();

			// Add snapper
			this.snappers = document.createElement("div");
			this.snappers.classList.add("snapper_container");

			if (pages === 1) {
				this.snappers.classList.add("snapper_single");
			}

			if (this.layout.props.divisor === 2) {
				this.snappers.classList.add("snapper_spreads");
			}

			this.element.insertBefore(this.snappers, this.iframe);

			var snapper = void 0;
			for (var i = 0; i < pages; i++) {
				snapper = document.createElement("div");
				snapper.classList.add("snapper");
				snapper.style.width = this.layout.pageWidth + "px";

				snapper.style.background = "#" + Math.floor(Math.random() * 16777215).toString(16);

				this.snappers.appendChild(snapper);
			}
		}
	}, {
		key: "clearSnapPoints",
		value: function clearSnapPoints() {
			if (this.snappers) {
				this.snappers.remove();
			}
		}
	}, {
		key: "stable",
		value: function stable(_stable) {
			if (_stable) {
				document.querySelector(".epub-container").classList.add("stable");
				this.element.classList.add("stable");
				// console.log("stable", this.index);
			} else {
				document.querySelector(".epub-container").classList.remove("stable");
				this.element.classList.remove("stable");
				// console.log("unstable", this.index);
			}
		}
	}, {
		key: "destroy",
		value: function destroy() {

			for (var cfiRange in this.highlights) {
				this.unhighlight(cfiRange);
			}

			for (var _cfiRange in this.underlines) {
				this.ununderline(_cfiRange);
			}

			for (var _cfiRange2 in this.marks) {
				this.unmark(_cfiRange2);
			}

			if (this.blobUrl) {
				(0, _core.revokeBlobUrl)(this.blobUrl);
			}

			if (this.displayed) {
				this.displayed = false;

				this.removeListeners();

				this.stopExpanding = true;
				this.element.removeChild(this.iframe);

				this.clearSnapPoints();

				this.iframe = undefined;
				this.contents = undefined;

				this._textWidth = null;
				this._textHeight = null;
				this._width = null;
				this._height = null;
			}

			// this.element.style.height = "0px";
			// this.element.style.width = "0px";
		}
	}]);

	return IframeView;
}();

(0, _eventEmitter2.default)(IframeView.prototype);

exports.default = IframeView;
module.exports = exports["default"];