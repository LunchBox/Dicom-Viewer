var strokeWidth = 1.5;
var zoomSlider = null;

var ImageWrapper = Class.create({
    initialize: function() {
        var defaults = {
            img: null,
            viewer: null,
            operator: null,
            initX: 0,
            initY: 0
        };

        this.options = Object.extend(defaults, arguments[0] || { });
        this.operator = this.options.operator;
        this.viewer = this.options.viewer;

        this.originalWidth = this.options.img.width;
        this.originalHeight = this.options.img.height;

        this.currentWidth = this.originalWidth;
        this.currentHeight = this.originalHeight;

        this.currentLeft = this.viewer.left + this.options.initX;
        this.currentTop = this.viewer.top + this.options.initY;

        this.currentPercentage = 1;

        this.pointPairs = new Array();
        this.distanceLines = new Array();
        this.rois = new Array();
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
        var marker = viewer.builder.circle(pointer[0], pointer[1], 2);
        //        var marker = viewer.builder.rect(pointer[0] - 2, pointer[1] - 2, 4, 4);
        marker.attr({
            stroke: color,
            fill: color
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
                stroke: color,
                "stroke-width": strokeWidth
            })

            for(var j = 0; j < points.length; j++){
                var point = this.calculateAbsolutePos(points[j]);
                var rp = this.calculatePos(point);
                if(j == 0){
                    painter.moveTo(rp.left, rp.top);
                }else{
                    painter.lineTo(rp.left, rp.top);
                }

                var marker = this.drawPoint([rp.left, rp.top], color);
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
                stroke: color,
                "stroke-width": strokeWidth
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
    resizeByDistance: function(distance){
        var p = this.currentPercentage + distance/200;

        if( p <= 2 && p >= 0.25){
            zoomSlider.setValue(p/2);
        }
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
        //        this.resize(percentage);
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

var animation = null;
var animationIndex = 0;
var animationControlBar = null;
function prePage(){
    animationIndex = ( animationIndex - 1) % images.length;
    if(animationIndex < 0) animationIndex = images.length - 1;
    //    $("iv_info").innerHTML = animationIndex;
    changePage();
}
function nextPage(){
    animationIndex = ( animationIndex + 1) % images.length;
    //    $("iv_info").innerHTML = animationIndex;
    changePage();
}
function changePage(){
    var images = viewer.options.images;
    viewer.image.operator.attr({
        src: images[animationIndex]
    })
    animationControlBar.setValue(animationIndex/images.length);
}
function playAnimation(){
    stopAnimation();
    animation = setInterval("nextPage()", 1000/6);
    $("play_animation").hide();
    $("stop_animation").show();
}
function stopAnimation(){
    clearInterval(animation);
    $("stop_animation").hide();
    $("play_animation").show();
}

var viewer;
var ImageViewer = Class.create({
    initialize: function(viewerID) {
        var defaults = {
            width: 640,
            height: 480,
            images: new Array(),
            onDistanceCreate:    Prototype.emptyFunction,
            onDistanceRemove:    Prototype.emptyFunction,
            onROICreate:         Prototype.emptyFunction,
            onROIRemove:         Prototype.emptyFunction
        };
        this.options = Object.extend(defaults, arguments[1] || { });

        this.options.images.each(function(url){
            var tmpImg = new Image();
            tmpImg.src = url;
        });
        var img = new Image();
        img.src = this.options.images[0];

        this.element = $(viewerID);

        this.width = Math.max(this.options.width, img.width);
        this.height = Math.max(this.options.height, img.height);

        var offset = this.element.cumulativeOffset();
        this.left = offset[0];
        this.top = offset[1];
        this.centerX = this.left + this.width/2;
        this.centerY = this.top + this.height/2;

        this.element.innerHTML = "";
        this.builder = Raphael(viewerID, this.width, this.height);
        var box = this.builder.rect(0, 0, this.width, this.height);
        box.attr({
            fill: "#000"
        });

        var initX = (this.width - img.width)/2 ;
        var initY = (this.height - img.height)/2 ;

        var operator = this.builder.image(this.options.images[0], initX, initY, img.width, img.height);
        this.image = new ImageWrapper({
            operator: operator,
            viewer: this,
            img: img,
            initX: initX,
            initY: initX
        });
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
        this.element.appendChild(infoArea);

        this.initializeZoomSlider(infoArea);

        var menus = new Element('div', {
            id: 'viewer_menus'
        });
        infoArea.appendChild(menus);

        var menus1 = new Element('div');
        menus.appendChild(menus1);

        var move = new Element("a", {
            id:"move_model",
            href:"javascript: moveModel();"
        }).update("Move");
        menus1.appendChild(move);

        var sZoom = new Element("a", {
            id:"s_zoom_model",
            href:"javascript: selectZoomModel();"
        }).update("SZoom");
        menus1.appendChild(sZoom);

        var dZoom = new Element("a", {
            id:"d_zoom_model",
            href:"javascript: dragZoomModel();"
        }).update("DZoom");
        menus1.appendChild(dZoom);

        var menus2 = new Element('div');
        menus.appendChild(menus2);

        var distance = new Element("a", {
            id:"distance_model",
            href:"javascript: distanceModel();"
        }).update("Distance");
        menus2.appendChild(distance);

        var roi = new Element("a", {
            id:"roi_model",
            href:"javascript: roiModel();"
        }).update("Make ROI");
        menus2.appendChild(roi);

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




        // play control bar
        if(this.options.images.length > 1){
            this.initializeAnimationControlBar();
        }
    },
    initializeZoomSlider: function(container){
        var slider = new Element('div', {
            id: 'zoom_slider'
        });

        var percentage = new Element('div', {
            id: 'zoom_percentage'
        }).update("100%");
        slider.appendChild(percentage);

        var sliderBox = new Element('div');
        var zoomOut = new Element('a',{
            id: "zoom_out",
            href: "javascript: zoomOut();"
        }).update("-")
        sliderBox.appendChild(zoomOut);

        var zoomTracker = new Element('div', {
            id: "zoom_tracker"
        });
        var zoomHandle = new Element("div", {
            id: "zoom_handle"
        });
        zoomTracker.appendChild(zoomHandle);
        sliderBox.appendChild(zoomTracker);

        var zoomIn = new Element("a", {
            id:"zoom_in",
            href:"javascript: zoomIn();"
        }).update("+");
        sliderBox.appendChild(zoomIn);

        slider.appendChild(sliderBox);
        container.appendChild(slider);

        zoomSlider = new Control.Slider("zoom_handle", "zoom_tracker", {
            sliderValue: 0.5,
            onSlide: function(v) {
                viewer.image.resize(v * 2);
            },
            onChange: function(v) {
                viewer.image.resize(v * 2);
            }
        });
    },
    initializeAnimationControlBar: function(){
        var controlBar = new Element('div', {
            id: 'control_bar'
        });

        var prePage = new Element("a", {
            id:"pre_page",
            href:"javascript: prePage();"
        }).update("Pre");
        controlBar.appendChild(prePage);
        var playAnimation = new Element("a", {
            id:"play_animation",
            href:"javascript: playAnimation();"
        }).update("Play");
        controlBar.appendChild(playAnimation);
        var stopAnimation = new Element("a", {
            id:"stop_animation",
            href:"javascript: stopAnimation();",
            style:"display:none;"
        }).update("Stop");
        controlBar.appendChild(stopAnimation);
        var nextPage = new Element("a", {
            id:"next_page",
            href:"javascript: nextPage();"
        }).update("Next");
        controlBar.appendChild(nextPage);
        var animationSlider = new Element("div", {
            id:"animation_slider"
        });
        var animationLine = new Element("div", {
            id:"animation_line"
        });
        animationSlider.appendChild(animationLine);
        var animationHandle = new Element("div", {
            id:"animation_handle"
        });
        animationSlider.appendChild(animationHandle);
        controlBar.appendChild(animationSlider);

        this.element.appendChild(controlBar);
        animationControlBar = new Control.Slider("animation_handle", "animation_slider", {
            sliderValue: 0,
            onSlide: function(v) {

            },
            onChange: function(v) {
            }
        });
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
        this.eventMouseDown = this.mouseDown.bindAsEventListener(this);
        this.eventMouseMove = this.mouseMove.bindAsEventListener(this);
        this.eventMouseUp = this.mouseUp.bindAsEventListener(this);

        Event.observe(viewer.element, "mousedown", this.eventMouseDown);
        Event.observe(document, "mousemove", this.eventMouseMove);
        Event.observe(document, "mouseup", this.eventMouseUp);
    },
    clearUP: function(){
        this.startResize = false;
        this.preDistance = null;
    },
    mouseDown: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];
        if(viewer.include(pointer)){
            this.startResize = true;
        }
    },
    mouseMove: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];
        if(viewer.include(pointer) && this.startResize){
            var distance = pointer[1];
            if(this.preDistance){
                var diff = distance - this.preDistance;
                viewer.image.resizeByDistance(diff);
            }

            this.preDistance = distance;
        }
    },
    mouseUp: function(){
        this.clearUP();
    },
    clear: function(){
        Event.stopObserving(viewer.element, "mousedown", this.eventMouseDown);
        Event.stopObserving(document, "mousemove", this.eventMouseMove);
        Event.stopObserving(document, "mouseup", this.eventMouseUp);
        this.clearUP();
    }
});

var SelectZoom = Class.create({
    initialize: function() {
        this.canvasBox = this.buildBox();

        this.eventMouseDown = this.mouseDown.bindAsEventListener(this);
        this.eventMouseMove = this.draw.bindAsEventListener(this);
        this.eventMouseUp = this.mouseUp.bindAsEventListener(this);

        Event.observe(viewer.element, "mousedown", this.eventMouseDown);
        Event.observe(document, "mousemove", this.eventMouseMove);
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
    cleanUp: function(){
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
        if(this.startPoint && viewer.include(pointer)){
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
        Event.stopObserving(document, "mousemove", this.eventMouseMove);
        Event.stopObserving(document, "mouseup", this.eventMouseUp);
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

        if(this.lastPoint){
            this.lastPoint.remove();
        }

        this.lastPoint = null;

        this.firstPoint = null;
        this.currentColor = null;
    },
    drawPoint: function(pointer){
        var p = viewer.image.calculatePos(pointer);
        var marker = viewer.builder.circle(p.left, p.top, 2);
        //        var marker = viewer.builder.rect(p.left - 2, p.top - 2, 4, 4);
        marker.attr({
            stroke: this.currentColor,
            fill: this.currentColor
        });

        return marker;
    },
    mouseDown: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];
        if(viewer.include(pointer)){
            this.firstPoint = pointer;
            this.currentColor = randomColor();
            this.pointMarkers.push(this.drawPoint(pointer));
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
                stroke: this.currentColor,
                "stroke-width": strokeWidth
            }).moveTo(l1, t1).lineTo(l2, t2);

            if(this.lastPoint){
                this.lastPoint.remove();
            }

            this.lastPoint = this.drawPoint(pointer);
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
    drawPoint: function(pointer, color){
        var p = viewer.image.calculatePos(pointer);
        var marker = viewer.builder.circle(p.left, p.top, 2);
        //        var marker = viewer.builder.rect(p.left - 2, p.top - 2, 4, 4);
        marker.attr({
            stroke: color
        //            fill: color
        });

        return marker;
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

            var marker = this.drawPoint(pointer, this.currentColor);
            this.pointMarkers.push(marker);

        //            if(this.preMarker){
        //                this.preMarker.attr({
        //                    fill: this.currentColor
        //                });
        //            }
        //
        //            this.preMarker = marker;
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
                stroke: this.currentColor,
                "stroke-width": strokeWidth
            }).moveTo(p1.left, p1.top).lineTo(p2.left, p2.top);
        }
    },
    end: function(event){
        var pointer = [Event.pointerX(event), Event.pointerY(event)];
        if(viewer.include(pointer)){
            //            this.points.pop();
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



function zoomIn(){
    zoomSlider.setValue(zoomSlider.value + 0.1);
}
function zoomOut(){
    zoomSlider.setValue(zoomSlider.value - 0.1);
}

var operateModel;
function switchModel(model, title){
    if(operateModel) operateModel.clear();
    operateModel = model;
    $("current_model").innerHTML = "Current Model: " + title;
}
function dragZoomModel(){
    switchModel(new DragZoom(), "drag zoom");
}

function selectZoomModel(){
    switchModel(new SelectZoom(), "select zoom");
}

function moveModel(){
    switchModel(new DragMove(), "move");
}

function roiModel(){
    switchModel(new ROIPainter(), "make ROI");
}

function distanceModel(){
    switchModel(new DistanceCalculator(), "distance");
}

function removeDistance(i){
    viewer.image.removeDistance(i);
}
function removeROI(i){
    viewer.image.removeROI(i);
}



// Array.remove from http://ejohn.org/blog/javascript-array-remove/
Array.prototype.remove = function(from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};