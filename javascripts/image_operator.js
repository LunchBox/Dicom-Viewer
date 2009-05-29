// Array.remove from http://ejohn.org/blog/javascript-array-remove/
Array.prototype.remove = function(from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

var ImageWrapper = Class.create({
    initialize: function(image) {
        this.image = $(image);
        this.src = this.image.src;
        this.originalWidth = parseInt(this.image.width);
        this.originalHeight = parseInt(this.image.height);
        this.currentWidth = this.originalWidth;
        this.currentHeight = this.originalHeight;
        this.currentPercentage = 1;

        this.pointPairs = new Array();
        this.distanceLines = new Array();
        this.rois = new Array();
    },
    buildOperator: function(viewer, initX, initY){
        this.viewer = viewer;
        this.operator = viewer.builder.image(this.src, initX, initY, this.originalWidth, this.originalHeight);
        this.currentLeft = viewer.left + initX;
        this.currentTop = viewer.top + initY;
    },
    calculateArea: function(xs, ys){
        var area = 0.0;
        for( var k = 0; k < xs.length - 1; k++ ) {
            var xDiff = xs[k+1] - xs[k];
            var yDiff = ys[k+1] - ys[k];
            area = area + xs[k] * yDiff - ys[k] * xDiff;
        }
        return Math.round(Math.abs(0.5 * area) * 100)/100;
    },

    calculatePerimeter: function(xs, ys){
        var perimeter = 0.0
        for( var k = 0; k < xs.vertices - 1; k++ ) {
            var xDiff = xs[k+1] - xs[k];
            var yDiff = ys[k+1] - ys[k];
            perimeter = perimeter + Math.pow( xDiff*xDiff + yDiff*yDiff, 0.5 );
        }
        return perimeter;
    },
    calculateRelativePos: function(x, y){
        return [(x - this.currentLeft)/this.currentWidth, (y - this.currentTop)/this.currentHeight];
    },
    calculateAbsolutePos: function(point){
        var tmp = new Hash();
        tmp.left = this.currentWidth * point[0] + this.currentLeft;
        tmp.top = this.currentHeight * point[1] + this.currentTop;
        return tmp;
    },
    calculateDistance: function(x1, y1, x2, y2){
        var distance = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));

        distance = Math.round(distance * 100/ this.currentPercentage)/100;
        return distance;
    },
    calculatePos: function(pointer){
        var tmp = new Hash();
        if(Object.isHash(pointer)){
            tmp.left = pointer.left - viewer.left;
            tmp.top = pointer.top - viewer.top;
        }else if(Object.isArray(pointer)){
            tmp.left = pointer[0] - viewer.left;
            tmp.top = pointer[1] - viewer.top;
        }
        return tmp;
    },
    initializeDistances: function(jsonStr){
        if(jsonStr.isJSON()){
            var pointPairs = jsonStr.evalJSON();
            if(Object.isArray(pointPairs)){
                this.pointPairs = pointPairs;
                this.drawDistanceLines();
            }
        }
    },
    initializeROIS: function(jsonStr){
        if(jsonStr.isJSON()){
            var rois = jsonStr.evalJSON();
            if(Object.isArray(rois)){
                this.rois = rois;
                this.drawROI();
            }
        }
    },
    cleanUpPainters: function(painters){
        if(painters){
            painters.each(function(rp){
                rp.remove();
            });
        }
    },
    drawPoint: function(pointer, color){
        var marker = viewer.builder.rect(pointer[0] - 2, pointer[1] - 2, 4, 4);
        marker.attr({
            stroke: color
        });
        return marker
    },
    recordROIPoints: function(points, color){
        if(points.length < 3) return;
        var roi = new Array();
        var xs = new Array();
        var ys = new Array();
        for(var i=0; i<points.length; i++){
            xs.push(points[i][0]);
            ys.push(points[i][1]);
            var point = this.calculateRelativePos(points[i][0], points[i][1]);
            roi.push(point);
        }
        var per = this.currentPercentage * this.currentPercentage;
        var area = Math.round(this.calculateArea(xs, ys)*100/per)/100;
        this.rois.push([roi, color, area]);
        this.drawROI();
        viewer.options.onROICreate(this.rois);
    },
    drawROI:function(){
        var roiList = $("roi_list");
        roiList.update("");

        this.cleanUpPainters(this.roiPainters);
        this.roiPainters = new Array();

        this.cleanUpPainters(this.roiMarkers);
        this.roiMarkers = new Array();

        for(var i=0; i< this.rois.length; i++){
            var points = this.rois[i][0];
            var color = this.rois[i][1];
            var area = this.rois[i][2];

            var firstPoint = this.calculateAbsolutePos(points[0]);
            var rfp = this.calculatePos(firstPoint);
            var painter = viewer.builder.path({
                stroke: color
            })

            for(var j = 0; j < points.length; j++){
                var point = this.calculateAbsolutePos(points[j]);
                var rp = this.calculatePos(point);
                if(j == 0){
                    painter.moveTo(rp.left, rp.top);
                }else{
                    painter.lineTo(rp.left, rp.top);
                }

                var marker = viewer.builder.rect(rp.left - 2, rp.top - 2, 4, 4);
                marker.attr({
                    stroke: color
                });
                this.roiMarkers.push(marker);
            }
            painter.lineTo(rfp.left, rfp.top);

            this.roiPainters.push(painter);

            var info = new Element('div', {
                style: 'color: ' + color
            }).update("ROI - " + area);
            var rm = new Element("a", {
                href:"javascript: removeROI("+ i +")"
            }).update("remove");
            info.appendChild(rm);
            roiList.appendChild(info);
        }
    },
    removeROI: function(i){
        this.rois.remove(parseInt(i));
        this.drawROI();
        viewer.options.onROIRemove(this.rois);
    },
    recordPointPair: function(x1, y1, x2, y2, color){
        var distance = this.calculateDistance(x1, y1, x2, y2);
        if(distance > 5){
            var p1 = this.calculateRelativePos(x1, y1);
            var p2 = this.calculateRelativePos(x2, y2);

            this.pointPairs.push([p1, p2, color]);
            this.drawDistanceLines();
            viewer.options.onDistanceCreate(this.pointPairs);
        }
    },
    clearRecordedPointPairs: function(){
        this.pointPairs.clear();
    },
    drawDistanceLines: function(){
        var distancesList = $("distances_list");
        distancesList.update("");

        this.distanceLines.each(function(dl){
            dl.painter.remove();
        });
        this.distanceLines = new Array();

        this.cleanUpPainters(this.distanceMarkers);
        this.distanceMarkers = new Array();

        var i;
        for(i=0; i< this.pointPairs.length; i++){
            var color = this.pointPairs[i][2];
            var p1 = this.calculateAbsolutePos(this.pointPairs[i][0]);
            var p2 = this.calculateAbsolutePos(this.pointPairs[i][1]);
            var rp1 = this.calculatePos(p1);
            var rp2 = this.calculatePos(p2);

            var distance = this.calculateDistance(rp1.left, rp1.top, rp2.left, rp2.top);
            var painter = viewer.builder.path({
                stroke: color
            });
            painter.moveTo(rp1.left, rp1.top).lineTo(rp2.left, rp2.top);

            var ps = Array(rp1, rp2);
            for(var k=0; k < ps.length; k++){
                var marker = this.drawPoint([ps[k].left, ps[k].top], color);
                this.distanceMarkers.push(marker);
            }

            var distanceLine = new Hash();
            distanceLine.painter = painter;
            distanceLine.distance = distance;
            this.distanceLines.push(distanceLine);

            var info = new Element('div', {
                style: 'color: ' + color
            }).update(distance + " pixels");
            var rm = new Element("a", {
                href:"javascript: removeDistance("+ i +")"
            }).update("remove");
            info.appendChild(rm);
            distancesList.appendChild(info);
        }
    },
    removeDistance: function(i){
        this.pointPairs.remove(parseInt(i));
        this.drawDistanceLines();
        viewer.options.onDistanceRemove(this.pointPairs);
    },
    resizeByCanvas: function(canvas){
        var left = canvas[0];
        var top = canvas[1];
        var width = canvas[2];
        var height = canvas[3];

        var perX = width / this.viewer.width;
        var perY = height / this.viewer.height;
        var percentage;
        if(perX > perY){
            percentage = this.currentWidth * (1/perX) / this.originalWidth;
        }else{
            percentage = this.currentHeight * (1/perY) / this.originalHeight;
        }

        // the center of selected area's relative position to the image.
        var point = this.calculateRelativePos((left + width/2), (top + height/2));

        if(percentage > 2) percentage = 2;
        this.resize(percentage);
        zoomSlider.setValue(percentage/2);

        var pointPos = this.calculateAbsolutePos(point);

        var diffX = this.viewer.centerX - pointPos.left;
        var diffY = this.viewer.centerY - pointPos.top;
        this.translate(diffX, diffY);
    },
    translate: function(diffX, diffY){
        this.operator.translate(diffX, diffY);
        this.currentLeft = this.currentLeft + diffX;
        this.currentTop = this.currentTop + diffY;
        this.drawDistanceLines();
        this.drawROI();
    },
    resize: function(percentage){
        if(percentage < 0.25) return;
        if(percentage == this.currentPercentage) return;
        var zoomPercentage = $("zoom_percentage");
        if(zoomPercentage){
            zoomPercentage.innerHTML = parseInt(percentage * 100) + "%";
        }

        this.currentWidth = this.originalWidth * percentage;
        this.currentHeight = this.originalHeight * percentage;

        var diffPercentage = percentage - this.currentPercentage;
        this.currentPercentage = percentage;

        var diffX = 0 - this.originalWidth * diffPercentage / 2;
        var diffY = 0 - this.originalHeight * diffPercentage / 2;

        this.operator.scale(percentage);
        this.translate(diffX, diffY);
    }
});

var viewer;
var ImageViewer = Class.create({
    initialize: function(viewerID, imageID) {
        var defaults = {
            width: 640,
            height: 480,
            onDistanceCreate:    Prototype.emptyFunction,
            onDistanceRemove:    Prototype.emptyFunction,
            onROICreate:         Prototype.emptyFunction,
            onROIRemove:         Prototype.emptyFunction
        };
        this.options = Object.extend(defaults, arguments[2] || { });

        this.image = new ImageWrapper(imageID);
        this.width = Math.max(this.options.width, this.image.originalWidth);
        this.height = Math.max(this.options.height, this.image.originalHeight);

        var imageViewer = $(viewerID);
        this.element = imageViewer;
        var offset = imageViewer.cumulativeOffset();
        this.left = offset[0];
        this.top = offset[1];
        this.centerX = this.left + this.width/2;
        this.centerY = this.top + this.height/2;

        imageViewer.innerHTML = "";
        this.builder = Raphael(viewerID, this.width, this.height);
        var box = this.builder.rect(0, 0, this.width, this.height);
        box.attr({
            fill: "#000"
        });

        var initX = (this.width - this.image.originalWidth)/2 ;
        var initY = (this.height - this.image.originalHeight)/2 ;

        this.image.buildOperator(this, initX, initY);
        //        this.selector = new DragSelector(viewer);


        this.buildViewer();


        viewer = this;
    },
    include: function(pointer){
        if(pointer[0] > this.left && pointer[1] > this.top && pointer[0] < (this.left + this.width) && pointer[1] < (this.top + this.height)){
            return true;
        }else{
            return false;
        }
    },
    buildViewer: function(){
        var infoArea = new Element('div', {
            id: 'info_area'
        });

        var zoomSlider = new Element('div', {
            id: 'zoom_slider'
        });
        infoArea.appendChild(zoomSlider);

        var menus = new Element('div', {
            id: 'viewer_menus'
        });
        var move = new Element("a", {
            id:"move_model",
            href:"javascript: moveModel();"
        }).update("Move");
        menus.appendChild(move);

        var zoom = new Element("a", {
            id:"zoom_model",
            href:"javascript: zoomModel();"
        }).update("Zoom");
        menus.appendChild(zoom);

        var distance = new Element("a", {
            id:"distance_model",
            href:"javascript: distanceModel();"
        }).update("Distance");
        menus.appendChild(distance);

        var roi = new Element("a", {
            id:"roi_model",
            href:"javascript: roiModel();"
        }).update("Make ROI");
        menus.appendChild(roi);
        infoArea.appendChild(menus);

        var currentModel = new Element('div', {
            id: 'current_model'
        }).update("Current Model: None");
        infoArea.appendChild(currentModel);

        var graphList = new Element('div', {
            id: 'graph_list'
        });
        var distancesList = new Element('div', {
            id: 'distances_list'
        });
        graphList.appendChild(distancesList);
        var roiList = new Element('div', {
            id: 'roi_list'
        });
        graphList.appendChild(roiList);
        infoArea.appendChild(graphList);

        var info = new Element('div', {
            id: 'iv_info'
        });
        infoArea.appendChild(info);

        this.element.appendChild(infoArea);

        initImageViewerZoomSlider(zoomSlider);
    },
    initializeDistances: function(jsonStr){
        this.image.initializeDistances(jsonStr);
    },
    initializeROIS: function(jsonStr){
        this.image.initializeROIS(jsonStr);
    }
});

var DragZoom = Class.create({
    initialize: function() {
        this.canvasBox = this.buildBox();

        this.eventMouseDown = this.mouseDown.bindAsEventListener(this);
        this.eventMouseMove = this.draw.bindAsEventListener(this);
        this.eventMouseUp = this.mouseUp.bindAsEventListener(this);

        Event.observe(viewer.element, "mousedown", this.eventMouseDown);
        Event.observe(viewer.element, "mousemove", this.eventMouseMove);
        Event.observe(document, "mouseup", this.eventMouseUp);
    },
    buildBox: function(){
        var id = "canvasBox";
        var element = $(id);
        if(element){
            return element;
        }else{
            var box = document.createElement("div");
            box.id = id;
            box.style.position = "absolute";
            box.style.zIndex = "10000";
            box.style.border = "1px solid blue";
            box.style.display = "none";
            document.body.appendChild(box);
            return box;
        }
    },
    cleanUP: function(){
        this.startPoint = null;
        this.currentCanvas = null
        this.canvasBox.hide();
    },
    mouseDown: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];
        if(viewer.include(pointer)){
            this.startPoint = pointer;
            this.canvasBox.style.width = '0px';
            this.canvasBox.style.height = '0px';
        }
    },
    draw: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];
        if(this.startPoint){
            var left = Math.min(this.startPoint[0], pointer[0])
            var top = Math.min(this.startPoint[1], pointer[1])
            var width = Math.abs(this.startPoint[0] - pointer[0]);
            var height = Math.abs(this.startPoint[1] - pointer[1]);
            this.currentCanvas = [left, top, width, height];

            this.canvasBox.style.left = left + "px";
            this.canvasBox.style.top = top + "px";
            this.canvasBox.style.width = width + "px";
            this.canvasBox.style.height = height + "px";
            this.canvasBox.show();
        }
    },
    mouseUp: function(){
        this.startPoint = null;
        this.canvasBox.hide();
        if(this.currentCanvas && this.currentCanvas[0] > 10 && this.currentCanvas[1] > 10){
            viewer.image.resizeByCanvas(this.currentCanvas);
        }
        this.currentCanvas = null;
    },
    clear: function(){
        Event.stopObserving(viewer.element, "mousedown", this.eventMouseDown);
        Event.stopObserving(viewer.element, "mousemove", this.eventMouseMove);
        Event.stopObserving(viewer.element, "mouseup", this.eventMouseUp);
        this.cleanUp();
    }
});

var DragMove = Class.create({
    initialize: function() {
        this.eventMouseDown = this.mouseDown.bindAsEventListener(this);
        this.eventMouseMove = this.mouseMove.bindAsEventListener(this);
        this.eventMouseUp = this.mouseUp.bindAsEventListener(this);

        Event.observe(viewer.element, "mousedown", this.eventMouseDown);
        Event.observe(viewer.element, "mousemove", this.eventMouseMove);
        Event.observe(viewer.element, "mouseup", this.eventMouseUp);
    },
    cleanUp: function(){
        this.prePoint = null;
        this.allowMove = false;
        document.body.style.cursor = 'default';
    },
    mouseDown: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];
        if(viewer.include(pointer)){
            document.body.style.cursor = 'pointer';
            this.allowMove = true
        }
    },
    mouseMove: function(event){
        if(this.prePoint && this.allowMove){
            var diffX = Event.pointerX(event) - this.prePoint[0];
            var diffY = Event.pointerY(event) - this.prePoint[1];
            viewer.image.translate(diffX, diffY);
        }
        this.prePoint = [Event.pointerX(event), Event.pointerY(event)];
    },
    mouseUp: function(){
        this.cleanUp();
    },
    clear: function(){
        Event.stopObserving(viewer.element, "mousedown", this.eventMouseDown);
        Event.stopObserving(viewer.element, "mousemove", this.eventMouseMove);
        Event.stopObserving(viewer.element, "mouseup", this.eventMouseUp);
        this.cleanUp();
    }
});


var DistanceCalculator = Class.create({
    initialize: function() {
        this.cleanUp();
        
        this.eventMouseDown = this.mouseDown.bindAsEventListener(this);
        this.eventMouseMove = this.draw.bindAsEventListener(this);
        this.eventMouseUp = this.mouseUp.bindAsEventListener(this);

        Event.observe(viewer.element, "mousedown", this.eventMouseDown);
        Event.observe(viewer.element, "mousemove", this.eventMouseMove);
        Event.observe(viewer.element, "mouseup", this.eventMouseUp);
    },
    cleanUp: function(){
        if(this.currentLine){
            this.currentLine.remove();
            this.currentLine = null;
        }
        
        if(this.pointMarkers){
            this.pointMarkers.each(function(mk){
                mk.remove();
            });
        }
        this.pointMarkers = new Array();
        
        this.firstPoint = null;
        this.currentColor = null;
    },
    drawPoint: function(pointer){
        var p = viewer.image.calculatePos(pointer);
        var marker = viewer.builder.rect(p.left - 2, p.top - 2, 4, 4);
        marker.attr({
            stroke: this.currentColor
        });

        this.pointMarkers.push(marker);
    },
    mouseDown: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];
        if(viewer.include(pointer)){
            this.firstPoint = pointer;
            this.currentColor = randomColor();
            this.drawPoint(pointer);
        }
    },
    draw: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];

        if(this.firstPoint && this.currentColor){
            var l1 = this.firstPoint[0] - viewer.left;
            var t1 = this.firstPoint[1] - viewer.top;
            var l2 = pointer[0] - viewer.left;
            var t2 = pointer[1] - viewer.top;

            if(this.currentLine){
                this.currentLine.remove();
            }

            this.currentLine = viewer.builder.path({
                stroke: this.currentColor
            }).moveTo(l1, t1).lineTo(l2, t2);
        }
    },
    mouseUp: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];
        if(this.firstPoint && viewer.include(pointer)){
            var x1 = this.firstPoint[0];
            var y1 = this.firstPoint[1];
            var x2 = pointer[0];
            var y2 = pointer[1];

            viewer.image.recordPointPair(x1, y1, x2, y2, this.currentColor);
            this.cleanUp();
        }
    },
    clear: function(){
        Event.stopObserving(viewer.element, "mousedown", this.eventMouseDown);
        Event.stopObserving(viewer.element, "mousemove", this.eventMouseMove);
        Event.stopObserving(viewer.element, "mouseup", this.eventMouseUp);
        this.cleanUp();
    }
});


var ROIPainter = Class.create({
    initialize: function() {
        this.cleanUp();

        this.eventMouseDown = this.addPoint.bindAsEventListener(this);
        this.eventMouseMove = this.drawROILine.bindAsEventListener(this);
        this.eventDoubleClick = this.end.bindAsEventListener(this);

        Event.observe(document, "mousedown", this.eventMouseDown);
        Event.observe(viewer.element, "mousemove", this.eventMouseMove);
        Event.observe(document, "dblclick", this.eventDoubleClick);
    },
    cleanUp: function(){
        if(this.lines){
            this.lines.each(function(line){
                line.remove();
            })
        }
        this.lines = new Array();

        if(this.pointMarkers){
            this.pointMarkers.each(function(marker){
                marker.remove();
            })
        }
        this.pointMarkers = new Array();

        if(this.currentLine){
            this.currentLine.remove();
        }
        this.currentLine = null;

        this.points = new Array();
        this.firstPoint = null;
        this.prePoint = null;

        this.currentColor = null;
    },
    addPoint: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];

        if(viewer.include(pointer)){

            if(!this.firstPoint){
                this.cleanUp();
                this.firstPoint = pointer;
                this.currentColor = randomColor();
            }

            if(this.prePoint){
                if(this.prePoint[0] != pointer[0] && this.prePoint[1] != pointer[1]){
                    this.points.push(pointer);
                }
            }else{
                this.points.push(pointer);
            }

            if(this.currentLine){
                this.lines.push(this.currentLine);
                this.currentLine = null;
            }

            this.prePoint = pointer;

            var p = viewer.image.calculatePos(pointer);
            var marker = viewer.builder.rect(p.left - 2, p.top - 2, 4, 4);
            marker.attr({
                stroke: this.currentColor
            });
            this.pointMarkers.push(marker);
        }
    },
    drawROILine: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];

        if(this.prePoint){
            var p1 = viewer.image.calculatePos(this.prePoint);
            var p2 = viewer.image.calculatePos(pointer);

            if(this.currentLine){
                this.currentLine.remove();
            }

            this.currentLine = viewer.builder.path({
                stroke: this.currentColor
            }).moveTo(p1.left, p1.top).lineTo(p2.left, p2.top);
        }
    },
    end: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];
        if(viewer.include(pointer)){
            this.points.pop();
            viewer.image.recordROIPoints(this.points, this.currentColor);

            this.cleanUp();
        }
    },
    clear: function(){
        Event.stopObserving(document, "mousedown", this.eventMouseDown);
        Event.stopObserving(viewer.element, "mousemove", this.eventMouseMove);
        Event.stopObserving(document, "dblclick", this.eventDoubleClick);

        this.cleanUp();
    }
});

///////////////////////////

function randomColor(){
    var colors = [0,1,2,3,4,5,6,7,8,9,"a","b","c","d","e","f"];
    var color = "#";
    for (var i = 0; i < 6; i++){
        color += colors[Math.round(Math.random()*14)];
    }
    return color;
}

var operateModel;

function zoomIn(){
    zoomSlider.setValue(zoomSlider.value + 0.1);
}
function zoomOut(){
    zoomSlider.setValue(zoomSlider.value - 0.1);
}
function zoomModel(){
    if(operateModel) operateModel.clear();
    operateModel = new DragZoom();
    $("current_model").innerHTML = "Current Model: zoom";
}
function moveModel(){
    if(operateModel) operateModel.clear();
    operateModel = new DragMove();
    $("current_model").innerHTML = "Current Model: move";
}
function roiModel(){
    if(operateModel) operateModel.clear();
    operateModel = new ROIPainter();
    $("current_model").innerHTML = "Current Model: Make ROI";
}
function distanceModel(){
    if(operateModel) operateModel.clear();
    operateModel = new DistanceCalculator();
    $("current_model").innerHTML = "Current Model: distance";
}

function removeDistance(i){
    viewer.image.removeDistance(i);
}
function removeROI(i){
    viewer.image.removeROI(i);
}

/////////////////////////        Initialize

var zoomSlider;
function initImageViewerZoomSlider(container){

    var percentage = document.createElement("div");
    percentage.id = "zoom_percentage";
    percentage.innerHTML = "100%";
    container.appendChild(percentage);

    var sliderBox = document.createElement("div");
    var zoomOut = document.createElement("a");
    zoomOut.id = "zoom_out";
    zoomOut.href = "javascript: zoomOut();";
    zoomOut.innerHTML = "-";
    sliderBox.appendChild(zoomOut);

    var zoomTracker = document.createElement("div");
    zoomTracker.id = "zoom_tracker";
    var zoomHandle = document.createElement("div");
    zoomHandle.id = "zoom_handle";
    zoomTracker.appendChild(zoomHandle);
    sliderBox.appendChild(zoomTracker);

    var zoomIn = document.createElement("a");
    zoomIn.id = "zoom_in";
    zoomIn.href = "javascript: zoomIn();";
    zoomIn.innerHTML = "+";
    sliderBox.appendChild(zoomIn);

    container.appendChild(sliderBox);

    zoomSlider = new Control.Slider("zoom_handle", "zoom_tracker", {
        sliderValue: 0.5,
        onSlide: function(v) {
            viewer.image.resize(v * 2);
        },
        onChange: function(v) {
            viewer.image.resize(v * 2);
        }
    });
}