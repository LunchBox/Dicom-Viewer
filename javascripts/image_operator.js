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
    recordROIPoints: function(points, color){
        if(points.length < 3) return;
        var roi = new Array;
        for(var i=0; i<points.length; i++){
            var point = this.calculateRelativePos(points[i][0], points[i][1]);
            roi.push(point);
        }
        this.rois.push([roi, color]);
    },
    drawROI:function(){
        var roiList = $("roi_list");
        roiList.update("");
        
        if(this.roiPainters){
            this.roiPainters.each(function(rp){
                rp.remove();
            });
        }
        this.roiPainters = new Array();
        
        for(var i=0; i< this.rois.length; i++){
            var points = this.rois[i][0];
            var color = this.rois[i][1];

            var firstPoint = this.calculateAbsolutePos(points[0]);
            var rfp = this.calculatePos(firstPoint);
            var painter = viewer.builder.path({
                stroke: color
            }).moveTo(rfp.left, rfp.top);

            for(var j = 1; j < points.length; j++){
                var point = this.calculateAbsolutePos(points[j]);
                var rp = this.calculatePos(point);
                painter.lineTo(rp.left, rp.top);
            }
            painter.lineTo(rfp.left, rfp.top);
            
            this.roiPainters.push(painter);

            var info = new Element('div', {
                style: 'color: ' + color
            }).update("ROI - " + i);
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
        var p1 = this.calculateRelativePos(x1, y1);
        var p2 = this.calculateRelativePos(x2, y2);
        
        this.pointPairs.push([p1, p2, color]);
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
    resizeByCanvas: function(){
        if(currentCanvas){
            var left = currentCanvas[0];
            var top = currentCanvas[1];
            var width = currentCanvas[2];
            var height = currentCanvas[3];
            
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
            
            currentCanvas = null;
        }
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
    initialize: function(viewerID, imageID, width, height) {
        this.width = width;
        this.height = height;
        this.image = new ImageWrapper(imageID);
        
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

        var defaults = {
            onDistanceCreate:    Prototype.emptyFunction,
            onDistanceRemove:    Prototype.emptyFunction,
            onROICreate:         Prototype.emptyFunction,
            onROIRemove:         Prototype.emptyFunction
        };
        this.options = Object.extend(defaults, arguments[4] || { });
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


////////////////////////    Drag and select
var canvasBox;
var startPointer; // for drag a area
var endPointer; // for drag a area
var firstPointer; // for draw line 
var currentCanvas;
function drawCanvas(e){
    if (!e) var e = window.event;
    endPointer = [Event.pointerX(e), Event.pointerY(e)];

    var left = Math.min(startPointer[0], endPointer[0])
    var top = Math.min(startPointer[1], endPointer[1])
    var width = Math.abs(startPointer[0] - endPointer[0]);
    var height = Math.abs(startPointer[1] - endPointer[1]);
    currentCanvas = [left, top, width, height];
    
    canvasBox.style.left = left + "px";
    canvasBox.style.top = top + "px";
    canvasBox.style.width = width + "px";
    canvasBox.style.height = height + "px";
    canvasBox.style.display = "";
}

var DragZoom = Class.create({
    initialize: function() {
        canvasBox = this.buildBox();

        viewer.element.onmousedown = this.trackMouse;
        document.body.onmouseup = this.stopTrack;
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
    trackMouse: function(e){
        if (!e) var e = window.event;
        startPointer = [Event.pointerX(e), Event.pointerY(e)];
        document.onmousemove = drawCanvas;
        canvasBox.style.width = '1px';
        canvasBox.style.height = '1px';
        canvasBox.style.display = "";
        return false;
    },
    stopTrack: function(){
        document.onmousemove = null;
        canvasBox.style.display = "none";

        viewer.image.resizeByCanvas();
    },
    clear: function(){
        viewer.element.onmousedown = null;
        document.body.onmouseup = null;
        document.onmousemove = null;
    }
});


var currentPointer;
function moveImage(e){
    if (!e) var e = window.event;
    if(currentPointer){
        var diffX = Event.pointerX(e) - currentPointer[0];
        var diffY = Event.pointerY(e) - currentPointer[1];
        viewer.image.translate(diffX, diffY);
    }
    currentPointer = [Event.pointerX(e), Event.pointerY(e)];
}

var DragMove = Class.create({
    initialize: function() {
        viewer.element.onmousedown = this.trackMouse;
        document.body.onmouseup = this.stopTrack;
    },
    trackMouse: function(e){
        document.body.style.cursor = 'pointer';
        document.onmousemove = moveImage;
    },
    stopTrack: function(){
        document.onmousemove = null;
        currentPointer = null;
        document.body.style.cursor = 'default';
    },
    clear: function(){
        viewer.element.onmousedown = null;
        document.body.onmouseup = null;
        document.onmousemove = null;
    }
});


var distanceFirstPointer;
var distanceLine;
function drawDistanceLine(e){
    if (!e) var e = window.event;
    var pointer = [Event.pointerX(e), Event.pointerY(e)];

    if(distanceFirstPointer && currentColor){
        var l1 = distanceFirstPointer[0] - viewer.left;
        var t1 = distanceFirstPointer[1] - viewer.top;
        var l2 = pointer[0] - viewer.left;
        var t2 = pointer[1] - viewer.top;
        if(distanceLine){
            distanceLine.remove();
            distanceLine = null;
        }
        distanceLine = viewer.builder.path({
            stroke: currentColor
        }).moveTo(l1, t1).lineTo(l2, t2);
    }
}

var currentColor;
var DistanceCalculator = Class.create({
    initialize: function() {
        viewer.element.onmousedown = this.startDraw;
        document.body.onmouseup = this.endDraw;
    },
    startDraw: function(e){
        if (!e) var e = window.event;

        var pointer = [Event.pointerX(e), Event.pointerY(e)];
        distanceFirstPointer = pointer;

        currentColor = randomColor();
        document.onmousemove = drawDistanceLine;
    },
    endDraw: function(e){
        if (!e) var e = window.event;

        document.onmousemove = null;
        
        var pointer = [Event.pointerX(e), Event.pointerY(e)];

        if(distanceFirstPointer){
            var x1 = distanceFirstPointer[0];
            var y1 = distanceFirstPointer[1];
            var x2 = pointer[0];
            var y2 = pointer[1];

            var distance = viewer.image.calculateDistance(x1, y1, x2, y2);
            if(distance > 5){
                viewer.image.recordPointPair(x1, y1, x2, y2, currentColor);
                viewer.image.drawDistanceLines();
                viewer.options.onDistanceCreate(viewer.image.pointPairs);
            }

            if(distanceLine){
                distanceLine.remove();
                distanceLine = null;
            }
            distanceFirstPointer = null;
        }
    },
    clear: function(){
        viewer.element.onmousedown = null;
        document.body.onmouseup = null;
        document.onmousemove = null;
    }
});


var roiFirstPoint, roiPrePoint, roiLines, currentROILine;
function drawROILine(e){
    if (!e) var e = window.event;
    var pointer = [Event.pointerX(e), Event.pointerY(e)];

    if(roiPrePoint){
        var p1 = viewer.image.calculatePos(roiPrePoint);
        var p2 = viewer.image.calculatePos(pointer);

        if(currentROILine){
            currentROILine.remove();
        }

        currentROILine = viewer.builder.path({
            stroke: currentColor
        }).moveTo(p1.left, p1.top).lineTo(p2.left, p2.top);
    }
}

var roiPoints;
var ROIPainter = Class.create({
    initialize: function() {
        document.onmousedown = this.addPoint;
        document.ondblclick = this.end;
        roiLines = new Array();
    },
    addPoint: function(e){
        if (!e) var e = window.event;
        var pointer = [Event.pointerX(e), Event.pointerY(e)];
        if(viewer.include(pointer)){
            if(!roiFirstPoint){
                roiFirstPoint = pointer;
                currentColor = randomColor();
                roiPoints = new Array();
                roiLines = new Array();
            }
            
            if(roiPrePoint){
                if(roiPrePoint[0] != pointer[0] && roiPrePoint[1] != pointer[1]){
                    roiPoints.push(pointer);
                }
            }else{
                roiPoints.push(pointer);
            }
            
            

            if(currentROILine){
                roiLines.push(currentROILine);
                currentROILine = null;
            }
            
            roiPrePoint = pointer;
            document.body.onmousemove = drawROILine;
        }
    },
    end: function(e){
        if (!e) var e = window.event;

        var pointer = [Event.pointerX(e), Event.pointerY(e)];
        if(viewer.include(pointer)){
            viewer.image.recordROIPoints(roiPoints, currentColor);
            viewer.image.drawROI();
            viewer.options.onROICreate(viewer.image.rois);

            document.onmousemove = null;
            roiFirstPoint = null;
            roiPrePoint = null;
            roiLines.each(function(line){
                line.remove();
            });
        }
    },
    clear: function(){
        document.onmousedown = null;
        document.ondblclick = null;
        document.onmousemove = null;
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

function createMenu(id, href, inner){
    var node = document.createElement("a");
    node.id = id;
    node.href = href;
    node.innerHTML = inner;
    return node;
}

function initImageViewerMenus(containerID){
    var container = $(containerID);
    
    container.appendChild(createMenu("move_model", "javascript: moveModel();", "Move"));
    container.appendChild(createMenu("zoom_model", "javascript: zoomModel();", "Zoom"));
    container.appendChild(createMenu("distance_model", "javascript: distanceModel();", "Distance"));
    container.appendChild(createMenu("roi_model", "javascript: roiModel();", "Make ROI"));
}
