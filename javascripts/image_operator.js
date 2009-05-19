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
        this.roiPoints = new Array();
    },
    buildOperator: function(viewer, initX, initY){
        this.viewer = viewer;
        this.operator = viewer.builder.image(this.src, initX, initY, this.originalWidth, this.originalHeight);
        this.currentLeft = viewer.left + initX;
        this.currentTop = viewer.top + initY;
    },
    calculateRelativePos: function(x, y){
        var tmp = new Hash();
        tmp.relativeLeftPos = (x - this.currentLeft)/this.currentWidth;
        tmp.relativeTopPos = (y - this.currentTop)/this.currentHeight;
        return tmp;
    },
    calculateAbsolutePos: function(point){
        var tmp = new Hash();
        tmp.left = this.currentWidth * point.relativeLeftPos + this.currentLeft;
        tmp.top = this.currentHeight * point.relativeTopPos + this.currentTop;
        return tmp;
    },
    calculateDistance: function(x1, y1, x2, y2){
        var distance = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
        
        distance = distance / this.currentPercentage;
//        $("current_distance").innerHTML = Math.round(distance) + " pixels";
    },
    recordROIPoint: function(pointer){
        var point = this.calculateRelativePos(pointer[0], pointer[1]);
        this.roiPoints.push(point);
    },
    drawROI:function(){
        if(this.roiPoints.length < 3) return;
        var firstPoint = this.calculateAbsolutePos(this.roiPoints[0]);
        if(this.roi){
            this.roi.remove();
        }
        this.roi = viewer.builder.path({
            stroke: "#036"
        }).moveTo(firstPoint.left - viewer.left, firstPoint.top - viewer.top);

        for(i = 1; i < this.roiPoints.length; i++){
            var point = this.calculateAbsolutePos(this.roiPoints[i]);
            this.roi.lineTo(point.left - viewer.left, point.top - viewer.top);
        }
        this.roi.lineTo(firstPoint.left - viewer.left, firstPoint.top - viewer.top);
    },
    recordPointPair: function(x1, y1, x2, y2){
        var p1 = this.calculateRelativePos(x1, y1);
        var p2 = this.calculateRelativePos(x2, y2);
        
        this.pointPairs.push([p1, p2]);
    },
    clearRecordedPointPairs: function(){
        this.pointPairs.clear();
    },
    clearDistanceLines: function(){
        var i;
        for(i=0; i< this.distanceLines.length; i++){
            var dl = this.distanceLines.pop(i);
            dl.remove();
        }
    },
    drawDistanceLines: function(){
        this.clearDistanceLines();
        for(i=0; i< this.pointPairs.length; i++){
            var p1 = this.calculateAbsolutePos(this.pointPairs[i][0]);
            var p2 = this.calculateAbsolutePos(this.pointPairs[i][1]);
            var dl = viewer.builder.path({
                stroke: "#036"
            }).moveTo(p1.left - viewer.left, p1.top - viewer.top).lineTo(p2.left - viewer.left, p2.top - viewer.top);
                
            this.distanceLines.push(dl);
        }
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

var ImageViewer = Class.create({
    initialize: function(viewer, image, width, height) {
        this.width = width;
        this.height = height;
        this.image = new ImageWrapper(image);
        
        var imageViewer = $(viewer);
        this.element = imageViewer;
        var offset = imageViewer.cumulativeOffset();
        this.left = offset[0];
        this.top = offset[1];
        this.centerX = this.left + this.width/2;
        this.centerY = this.top + this.height/2;

        imageViewer.innerHTML = "";
        this.builder = Raphael(viewer, this.width, this.height);

        var initX = (this.width - this.image.originalWidth)/2 ;
        var initY = (this.height - this.image.originalHeight)/2 ;

        this.image.buildOperator(this, initX, initY);
    //        this.selector = new DragSelector(viewer);
    },
    include: function(pointer){
        if(pointer[0] > this.left && pointer[1] > this.top && pointer[0] < (this.left + this.width) && pointer[1] < (this.top + this.height)){
            return true;
        }else{
            return false;
        }
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
    }
});


var distanceFirstPointer;
var distanceLine;
function drawDistanceLine(e){
    if (!e) var e = window.event;
    var pointer = [Event.pointerX(e), Event.pointerY(e)];

    if(distanceFirstPointer){
        var l1 = distanceFirstPointer[0] - viewer.left;
        var t1 = distanceFirstPointer[1] - viewer.top;
        var l2 = pointer[0] - viewer.left;
        var t2 = pointer[1] - viewer.top;
        if(distanceLine){
            distanceLine.remove();
            distanceLine = null;
        }
        distanceLine = viewer.builder.path({
            stroke: "#036"
        }).moveTo(l1, t1).lineTo(l2, t2);
    }
}

var DistanceCalculator = Class.create({
    initialize: function() {
        viewer.element.onmousedown = this.startDraw;
        document.body.onmouseup = this.endDraw;
    },
    startDraw: function(e){
        if (!e) var e = window.event;

        var pointer = [Event.pointerX(e), Event.pointerY(e)];
        distanceFirstPointer = pointer;

        document.onmousemove = drawDistanceLine;
    },
    endDraw: function(e){
        if (!e) var e = window.event;

        document.onmousemove = null;
        
        var pointer = [Event.pointerX(e), Event.pointerY(e)];

        if(distanceFirstPointer){
            viewer.image.recordPointPair(distanceFirstPointer[0], distanceFirstPointer[1], pointer[0], pointer[1]);
            viewer.image.drawDistanceLines();
            viewer.image.calculateDistance(distanceFirstPointer[0], distanceFirstPointer[1], pointer[0], pointer[1]);

            if(distanceLine){
                distanceLine.remove();
                distanceLine = null;
            }
            distanceFirstPointer = null;
        }
    }
});


var roiFirstPoint, roiPrePoint, roiLines, currentROILine;
function drawROILine(e){
    if (!e) var e = window.event;
    var pointer = [Event.pointerX(e), Event.pointerY(e)];

    if(roiPrePoint){
        var l1 = roiPrePoint[0] - viewer.left;
        var t1 = roiPrePoint[1] - viewer.top;
        var l2 = pointer[0] - viewer.left;
        var t2 = pointer[1] - viewer.top;

        if(currentROILine){
            currentROILine.remove();
            currentROILine = null;
        }

        currentROILine = viewer.builder.path({
            stroke: "#036"
        }).moveTo(l1, t1).lineTo(l2, t2);
    }
}

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
            roiPrePoint = pointer;
            if(!roiFirstPoint){
                roiFirstPoint = pointer;
            }
            
            viewer.image.recordROIPoint(pointer);

            if(currentROILine){
                roiLines.push(currentROILine);
                currentROILine = null;
            }
            document.body.onmousemove = drawROILine;
        }
    },
    end: function(e){
        if (!e) var e = window.event;
        var pointer = [Event.pointerX(e), Event.pointerY(e)];

        viewer.image.recordROIPoint(pointer);
        viewer.image.drawROI();

        document.onmousemove = null;
        roiFirstPoint = null;
        roiPrePoint = null;
        roiLines.each(function(line){
            line.remove();
        });
    }
});
///////////////////////////
var operateModel;

function zoomIn(){
    zoomSlider.setValue(zoomSlider.value + 0.1);
}
function zoomOut(){
    zoomSlider.setValue(zoomSlider.value - 0.1);
}
function zoomModel(){
    operateModel = new DragZoom();
//    $("current_model").innerHTML = "zoom";
}
function moveModel(){
    operateModel = new DragMove();
//    $("current_model").innerHTML = "move";
}
function roiModel(){
    operateModel = new ROIPainter();
//    $("current_model").innerHTML = "ROI";
}
function distanceModel(){
    operateModel = new DistanceCalculator();
//    $("current_model").innerHTML = "distance";
}
/////////////////////////        Initialize

var zoomSlider;
function initImageViewerZoomSlider(containerID){
    var container = $(containerID);
    
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

var viewer = new ImageViewer("image_viewer", "image", 950, 480);
initImageViewerMenus("viewer_menus");
initImageViewerZoomSlider("zoom_slider");