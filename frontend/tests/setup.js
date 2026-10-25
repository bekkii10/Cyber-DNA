// jsdom does not implement layout APIs that ProseMirror and our floating UI call. These stubs are for tests only.
const rect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} });
document.elementFromPoint = document.elementFromPoint || (() => null);
Element.prototype.getClientRects = Element.prototype.getClientRects || (() => []);
Range.prototype.getClientRects = Range.prototype.getClientRects || (() => []);
Range.prototype.getBoundingClientRect = Range.prototype.getBoundingClientRect || rect;
Element.prototype.scrollTo = Element.prototype.scrollTo || (() => {});
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
