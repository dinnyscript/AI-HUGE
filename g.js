"use strict";



var id = 0;
//INITIATION
var canvas = document.querySelector("#c");
var gl = canvas.getContext('webgl');
var program = webglUtils.createProgramFromScripts(gl,["vertex-shader-3d","fragment-shader-3d"]);

var UIcanvas = document.querySelector("#UI")
var ctx = UIcanvas.getContext('2d');

gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);


var a_positionL = gl.getAttribLocation(program, "a_position");
var u_matrixL = gl.getUniformLocation(program, "u_matrix");
var a_colorL = gl.getAttribLocation(program, "a_color");
var u_alpha = gl.getUniformLocation(program, "u_alpha");

var positionBuffer = gl.createBuffer();
var colorBuffer = gl.createBuffer();
//positions = [0, 0,0,0.7, 0,0,0, 0.5,0];
loadposcol( getCube(), getCubeColors() );
var UI = {
    scale : 1,
}
resize(); // fix this later
addNewEvents();

// Tell it to use our program (pair of shaders)
gl.useProgram(program);

gl.enableVertexAttribArray(a_positionL);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
vertexAttribPointer(a_positionL, 3, gl.FLOAT, false, 0, 0);

gl.enableVertexAttribArray(a_colorL);
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
vertexAttribPointer(a_colorL, 3, gl.UNSIGNED_BYTE, true, 0, 0);

//GAME VARIABLES
class room {
    constructor(x,y,z,position, blocks, colors) {
        this.coords = generateBoxOutside(x,y,z,position[0],position[1],position[2]);
        this.colors = colors;
        this.bounds = [[position[0],position[0]+x],[position[1],position[1]+y],[position[2]-z,position[2]]];
        this.blocks = blocks;
    }
    get playerCollision() {
        var vector = [0,0,0];
        var force = 0; var singlePush; var collision = 0;
        player.bounds = [[player.pos[0]-40,player.pos[0]+40],[player.pos[1]-88,player.pos[1]+20],[player.pos[2]-40,player.pos[2]+40]];
        var relatives = [[-40,40],[-88,20],[-40,40]];
        clampIn(player.bounds,this.bounds, relatives);
        
        for (var i = 0; i < this.blocks.length; i++) {
            if (this.blocks[i].playerCollision(relatives)) {
                collision++;
            }
            //vector = addVec3(singlePush,vector);
            //force += Math.sqrt(singlePush[0]**2+singlePush[1]**2+singlePush[2]**2);
        }
        return collision;
    }
    renderRoom(perspective) {
        loadposcol(this.coords,this.colors);
        drawArrays(gl.TRIANGLES,0,this.coords.length/3);
        var tele = -1;
        gl.uniform1f(u_alpha,1/3); 
        for (var i = this.blocks.length-1; i >= 0; i--) {
            var block = this.blocks[i];
            if (!block.tele) {
                if (block.physics()) {
                    this.blocks.splice(i,1);
                } else {
                    var translation = m4.translate(perspective,block.position[0],block.position[1],block.position[2]);
                    gl.uniformMatrix4fv(u_matrixL, false, translation);
                    loadposcol(block.coords,block.colors)
                    
                    drawArrays(gl.TRIANGLES,0,block.coords.length/3);
                }
            } else {
                tele = this.blocks[i];
            }
        }
        if (tele != -1) {
            gl.uniform1f(u_alpha,1/3); gl.disable(gl.CULL_FACE);
            gl.uniformMatrix4fv(u_matrixL, false, perspective);
            loadposcol(tele.coords,tele.colors);
            drawArrays(gl.TRIANGLES, 0, tele.coords.length/2);
            gl.enable(gl.CULL_FACE);
        }
    }
    addBlock(block) {
        this.blocks.push(block);
    }
}
class block {
    constructor(x,y,z,position, colors, destroyable, vx,vz, tele) {
        this.x = x;
        this.y = y;
        this.z = z;
        if (vx && (vx > 0 || vz > 0)) {
            this.vx = vx;
            this.vz = vz;
            this.move = true;
        } else {
            this.vx = 0;
            this.vz = 0;
            this.move = false;
        }
        this.position = position;
        this.coords = generateBoxInside(100,100,100,0,0,0);
        if (tele) {
            this.tele = true;
            this.colors = repeatColor([104, 252, 113],6*6);
        } else {
            this.colors = colors;
            this.tele = false;
        }
        id++;
        this.id = id;
        this.destroyable = destroyable;
        this.bounds = [[position[0],position[0]+x],[position[1],position[1]+y],[position[2]-z,position[2]]];
    }
    physics() {
        var collision = this.blockCollision;
        if (collision != -1) {
            this.x*=collision[0];
            this.y*=collision[1];
        }
        this.position[0] += this.vx;
        this.position[2] += this.vz;
        this.bounds = [[this.position[0],this.position[0]+this.x],[this.position[1],this.position[1]+this.y],[this.position[2]-this.z,this.position[2]]];
        if (Math.round(this.position[0] > 100) || Math.round(this.position[2] > 100)) {
            return true;
        }
        return false;
    }
    playerCollision(relatives) {
        if (!this.tele) {
            return clampOut(player.bounds,this.bounds,relatives);
        }    
    }
    get blockCollision() {
        //PRECONDITION: is moving
        //returns -1 if false, [sign1,sign2] where sign1 is x flip, sign2 is y flip
        return -1;
    }
    get swordCollision() {
        if (!this.tele) {

        }
    }
}
var keys = [];
var frictionc = 18;
var camera = {
    pos : [0,100,0],
    angleY : 0,
    angleX : 0.1,
    distance : 800,
    drag : false,
}
var pscale = 1.5;
var u = Math.pow(3,0.5)*pscale;
var transition = {
    transitioning : false,
    finished : false,
    time : 0,
    duration : 1,
    originalPos : [],
    finalPos : [],
    go : function(delta) {
        if (this.transitioning) {
            this.time += Math.min(delta,this.duration-this.time);

            player.transition(this.originalPos, this.finalPos, this.time, this.duration);
            if (this.time >= this.duration) {
                this.transitioning = false;
                this.finished = true;
            }
        }
    },
    initialize : function(oPos, fPos, t, duration) {
        this.transitioning = true;
        this.time = t; this.duration = duration; this.originalPos = oPos; this.finalPos = fPos;
        this.finished = false;
            
    }
}
var sword = {
    coords : HUGEsword(),
    right : [],
    left : [],
    activated : true,
    swiping : false,
    render : function(full) {
        if (this.activated) {
            var translation = m4.yRotate(full,this.baseangle);
            translation = m4.zRotate(translation, this.rotation[3]);
            translation = m4.yRotate(translation,this.rotation[4]);
            
            //translation = m4.yRotate(translation, this.rotation[3]);
            
            translation = m4.translate(translation,this.position[0]-player.translate[0],this.position[1]-player.translate[1], this.position[2]-player.translate[2]);
            translation = m4.scale(translation,20,20,20);
            translation = m4.xRotate(translation,this.rotation[0]);
            translation = m4.yRotate(translation,this.rotation[1]);
            translation = m4.zRotate(translation,this.rotation[2]);
            translation = m4.translate(translation,-0.7, 0,0);
            loadposcol(sword.coords[0],sword.coords[1]);
            gl.uniformMatrix4fv(u_matrixL, false, translation);
            drawArrays(gl.TRIANGLES, 0, 60);
        }
    },
    rotation : [degToRad(-10), degToRad(0), degToRad(-130),0,0],
    //rotation : [0,0,0],
    position : [22*u,30*u,2*u],
    baseangle : 0,
    anglecopy : 0,
    swipeangle : 0,
    slashstate : function() {
        return [...[Math.PI/2,0,0,this.swipeangle,0],...[10*u,0,0],this.anglecopy];
    },
    angleState : function() {
        return [...this.rotation,...this.position,this.baseangle];
    },
    idle : function() {
        this.rotation = [...player.sword.rotation];
        this.position = [...player.sword.position];
        this.baseangle = player.sword.baseangle;
    },
    idlestate : function() {
        return [...player.sword.rotation, ...player.sword.position, player.sword.baseangle];
    },
    slash : function(t) {
        var angle = t*Math.PI;
        this.baseangle = this.anglecopy;
        this.rotation = [Math.PI/2,0,0,this.swipeangle,angle];

        this.position = [25*u,0,0];
    },
    transition : function(swordF, swordO, t, duration) {
        var w1 = t/duration;
        var w2 = 1-w1;
        var state = []
        for (var i = 0; i < 5; i++) {
            state.push(swordO[i]+angleDif(swordO[i],swordF[i])*w2);
            //swordO[i] = positiveMod(swordO[i],2*Math.PI);
        }
        for (var i = 2; i < 5; i++) {
            state.push(swordO[i+3]+(swordF[i+3]-swordO[i+3])*w2);
        }
        state.push(swordO[8]+angleDif(swordO[8],swordF[8])*w2);
        //swordO[6] = positiveMod(swordO[6], 2*Math.PI);
        this.applyState(state);
    },
    applyState : function(state) {
        state = [...state];
        this.rotation = [state.shift(),state.shift(),state.shift(), state.shift(), state.shift()];
        this.position = [state.shift(),state.shift(),state.shift()];
        this.baseangle = state.shift();
    }
}
var swordtransition = {
    transitioning : false,
    finished : true,
    time : 0,
    duration : 1,
    originalPos : [],
    finalPos : [],
    go : function(delta) {
        if (this.transitioning) {
            this.time += Math.min(delta,this.duration-this.time);
            sword.transition(this.originalPos, this.finalPos, this.time, this.duration);
            if (this.time >= this.duration) {
                this.transitioning = false;
                this.finished = true;
            }
        }
    },
    initialize : function(oPos, fPos, t, duration) {
        this.transitioning = true;
        this.time = t; this.duration = duration; this.originalPos = oPos; this.finalPos = fPos;
        this.finished = false;
    }
}
var player = {
    pos : [0,0,-600],
    vector : [0,0,0],
    movement : [0,0,0],
    accel : 40,
    turnspeed : 7,
    msp : 8*60,
    grounded : true,
    translate : [0,0,0],
    groundY : -47.7*u,
    jumpQueue : 0,
    jumpStrength : 500,

    tension : 0,

    angle : 0,
    lshoulder : [degToRad(20),degToRad(-2)],
    rshoulder : [degToRad(20),degToRad(-2)],
    lbow : [degToRad(170),degToRad(20)],
    rbow : [degToRad(170),degToRad(20)],
    lhip : [degToRad(20),degToRad(5)],
    rhip : [degToRad(20),degToRad(5)],
    lknee : [degToRad(170),degToRad(-10)],
    rknee : [degToRad(170),degToRad(-10)],
    ltoe : degToRad(90),
    rtoe : degToRad(90),
    shoulderpoint : [0,-6.5*u,0],
    hippoint : [0,-23*u,0],
    armlength : 10*u,
    wristlength : 12*u,
    wristwidth : 3*u,
    leglength : 12*u,
    shinlength : 14*u,
    toelength : 2*u,
    toewidth : 3*u,
    tilt : degToRad(0),
    stepstate : 0,
    stop : [],
    running : [[],[]],
    nJump : [],

    sword : {
        rotation : [degToRad(-10), degToRad(0), degToRad(-130), 0,0],
        //rotation : [0,0,0],
        position : [22*u,30*u,2*u],
        baseangle : 0,
    },

    angleState : function() {
        return [this.angle, ...this.lshoulder, ...this.rshoulder, ...this.lbow, ...this.rbow, ...this.lhip, ...this.rhip, ...this.lknee, ...this.rknee, this.ltoe, this.rtoe, this.tilt, ...this.translate, ...this.sword.rotation, ...this.sword.position];
    },
    getCoords : function() {
        var lines = [0,-5*u,0,...this.hippoint]; //backbone
        var lines2 = [0,-5*u,0,...this.hippoint];
        var triangles = [];
        var temp, temp2, temp3, tri, tri2, tri3, tri4, mat;

        //left arm
        mat = m4.multiply(m4.translation(0,-this.armlength,0),m4.xRotate(m4.yRotation(this.lbow[1]),Math.PI-this.lbow[0]));
        tri = matmult([0,-this.wristlength,this.wristwidth/2],mat); tri2 = matmult([0,-this.wristlength,-this.wristwidth/2],mat);
        temp2 = matmult([0,-this.wristlength,0],mat);
        temp = [0,-this.armlength,0];
        mat = m4.multiply(m4.translation(0,this.shoulderpoint[1],0),m4.xRotate(m4.zRotation(this.lshoulder[0]),this.lshoulder[1]));
        temp = matmult(temp,mat); temp2 = matmult(temp2,mat); 
        tri = matmult(tri,mat); tri2 = matmult(tri2,mat);
        lines = [...lines,...this.shoulderpoint,...temp,...temp,...temp2];
        triangles = [...triangles, ...temp, ...tri, ...tri2];
        sword.left = [[...temp2],[...tri]];

        //right arm
        mat = m4.multiply(m4.translation(0,-this.armlength,0),m4.xRotate(m4.yRotation(-this.rbow[1]),Math.PI-this.rbow[0]));
        tri = matmult([0,-this.wristlength,this.wristwidth/2],mat); tri2 = matmult([0,-this.wristlength,-this.wristwidth/2],mat);
        temp2 = matmult([0,-this.wristlength,0],mat);
        temp = [0,-this.armlength,0];
        mat = m4.multiply(m4.translation(0,this.shoulderpoint[1],0),m4.xRotate(m4.zRotation(-this.rshoulder[0]),this.rshoulder[1]));
        temp = matmult(temp,mat);
        temp2 = matmult(temp2,mat);
        tri = matmult(tri,mat); tri2 = matmult(tri2,mat);
        lines = [...lines,...this.shoulderpoint,...temp,...temp,...temp2];
        triangles = [...triangles, ...temp, ...tri, ...tri2];
        sword.right = [[...temp2],[...tri]];

        //left leg
        mat = m4.multiply(m4.translation(0,-this.shinlength,0),m4.xRotation(this.ltoe));
        tri3 = matmult([this.toewidth/2,-this.toelength,0], mat); tri4 = matmult([-this.toewidth/2,-this.toelength,0], mat);
        temp = matmult([0,-this.toelength,0],mat);
        temp2 = [0,-this.shinlength,0]; tri = [this.toewidth/2, -this.shinlength, 0]; tri2 = [-this.toewidth/2, -this.shinlength, 0];
        mat = m4.multiply(m4.translation(0,-this.leglength,0),m4.xRotate(m4.zRotation(this.lknee[1]),this.lknee[0]-Math.PI));
        tri = matmult(tri, mat); tri2 = matmult(tri2, mat); tri3 = matmult(tri3, mat); tri4 = matmult(tri4, mat);
        temp = matmult(temp, mat); temp2 = matmult(temp2,mat);
        temp3 = [0,-this.leglength,0];
        mat = m4.multiply(m4.translation(0,this.hippoint[1],0),m4.xRotate(m4.zRotation(this.lhip[0]),this.lhip[1]));
        tri = matmult(tri, mat); tri2 = matmult(tri2, mat); tri3 = matmult(tri3, mat); tri4 = matmult(tri4, mat);
        temp = matmult(temp,mat); temp2 = matmult(temp2,mat); temp3 = matmult(temp3,mat);
        lines = [...lines,...this.hippoint,...temp3,...temp3,...temp2,...temp2,...temp];
        triangles = [...triangles, ...temp3, ...tri, ...tri2,
            ...tri, ...tri4, ...tri3,
            ...tri2, ...tri, ...tri4,
        ];

        //right leg
        mat = m4.multiply(m4.translation(0,-this.shinlength,0),m4.xRotation(this.rtoe));
        tri3 = matmult([this.toewidth/2,-this.toelength,0], mat); tri4 = matmult([-this.toewidth/2,-this.toelength,0], mat);
        temp = matmult([0,-this.toelength,0],mat);
        temp2 = [0,-this.shinlength,0]; tri = [this.toewidth/2, -this.shinlength, 0]; tri2 = [-this.toewidth/2, -this.shinlength, 0];
        mat = m4.multiply(m4.translation(0,-this.leglength,0),m4.xRotate(m4.zRotation(-this.rknee[1]),this.rknee[0]-Math.PI));
        tri = matmult(tri, mat); tri2 = matmult(tri2, mat); tri3 = matmult(tri3, mat); tri4 = matmult(tri4, mat);
        temp = matmult(temp, mat); temp2 = matmult(temp2,mat);
        temp3 = [0,-this.leglength,0];
        mat = m4.multiply(m4.translation(0,this.hippoint[1],0),m4.xRotate(m4.zRotation(-this.rhip[0]),this.rhip[1]));
        tri = matmult(tri, mat); tri2 = matmult(tri2, mat); tri3 = matmult(tri3, mat); tri4 = matmult(tri4, mat);
        temp = matmult(temp,mat); temp2 = matmult(temp2,mat); temp3 = matmult(temp3,mat);
        lines = [...lines,...this.hippoint,...temp3,...temp3,...temp2,...temp2,...temp];
        triangles = [...triangles, ...temp3, ...tri, ...tri2,
            ...tri, ...tri4, ...tri3,
            ...tri2, ...tri, ...tri4,
        ];
        return [lines,triangles];
    },
    getfeet : function() {
        var temp2, temp3, mat, mat2;
        var feet = [];
        mat2 = m4.xRotation(-player.tilt);

        temp2 = [0,-this.shinlength,0];
        mat = m4.multiply(m4.translation(0,-this.leglength,0),m4.xRotate(m4.zRotation(this.lknee[1]),this.lknee[0]-Math.PI));
        temp2 = matmult(temp2,mat);
        mat = m4.multiply(m4.translation(0,this.hippoint[1],0),m4.xRotate(m4.zRotation(this.lhip[0]),this.lhip[1]));
        temp2 = matmult(temp2,mat);
        temp2 = matmult(temp2, mat2);
        feet.push(temp2);

        temp2 = [0,-this.shinlength,0];
        mat = m4.multiply(m4.translation(0,-this.leglength,0),m4.xRotate(m4.zRotation(-this.rknee[1]),this.rknee[0]-Math.PI));
        temp2 = matmult(temp2,mat);
        mat = m4.multiply(m4.translation(0,this.hippoint[1],0),m4.xRotate(m4.zRotation(-this.rhip[0]),this.rhip[1]));
        temp2 = matmult(temp2,mat);
        temp2 = matmult(temp2, mat2);
        feet.push(temp2);

        return feet;
    },
    run : function(t) {
        var cycle = 0.7;
        var angle = (t%cycle)/cycle*2*Math.PI;
        var swing = Math.sin(angle);
        this.lhip[1] = swing/1+0.4;
        this.rhip[1] = -swing/1+0.4;
        this.lknee[0] = swing/3+2.5;
        this.rknee[0] = -swing/3+2.5;
        
        this.lshoulder[1] = -swing/1.2;
        this.lbow[0] = swing/2+2.8;
        this.rshoulder[1] = swing/1.2;
        this.rbow[0] = -swing/2+2.8;
        this.tilt = degToRad(20);
        player.translate[1] = Math.sin(angle*2)*5;
        if (angle > Math.PI) {
            this.stepstate = 0;
        } else {
            this.stepstate = 1;
        }
        /*if (Math.abs(angle-0.2-Math.PI/2) <= 0.06) {
            this.vector[1] += Math.sin(angle);
        } else if (Math.abs(angle-0.2-Math.PI*3/2) <= 0.06) {
            this.vector[1] += 1;
        }*/
        //this.lknee[1] = angle;
        //this.sword.rotation = []
        //this.sword.position = [-20*u, 25*u, 15*u];
        this.sword.position[2] = 15*u;
    },
    jump : function(t) {
        //ASSUMES PLAYER IS GROUNDED
        var scale = 4;
        t = t*scale;
        t = Math.min(t,1);
        t = t**2;
        //t = 0;
        this.tilt = degToRad(0);
        this.lhip[1] = degToRad(80-t*75); this.rhip[1] = degToRad(80-t*75);
        this.lhip[0] = degToRad(30); this.rhip[0] = degToRad(30);
        this.lknee[0] = degToRad(40+t*140);
        this.rknee[0] = degToRad(40+t*140);

        this.lshoulder[1] = degToRad(-120+290*t);
        this.lbow[0] = degToRad(50*t+110);
        this.lshoulder[0] = degToRad(20+15*t);
        this.lbow[1] = degToRad(20-90*t);

        this.rshoulder[1] = degToRad(-120+290*t);
        this.rbow[0] = degToRad(50*t+110);
        this.rshoulder[0] = degToRad(20+15*t);
        this.rbow[1] = degToRad(20-90*t);

        var feet = player.getfeet();
        this.translate[1] = -(Math.min(feet[0][1],feet[1][1])-this.groundY);
        this.sword.position[2] = 4*u;
    },
    transition : function(playerO, playerF, t, duration) {
        //linear
        //weight 1 and weight 2
        var w1 = t/duration;
        var w2 = 1-w1;
        var state = [];
        for (var i = 0; i < playerO.length; i++) {
            state.push(playerO[i]*w2+playerF[i]*w1);
        }
        this.applyState(state);
    },
    applyState : function(state) {
        var state = [...state];
        this.angle = state.shift();
        this.lshoulder = [state.shift(),state.shift()];
        this.rshoulder = [state.shift(), state.shift()];
        this.lbow = [state.shift(), state.shift()];
        this.rbow = [state.shift(), state.shift()];
        this.lhip = [state.shift(), state.shift()];
        this.rhip = [state.shift(), state.shift()];
        this.lknee = [state.shift(), state.shift()];
        this.rknee = [state.shift(), state.shift()];
        this.ltoe = state.shift(); this.rtoe = state.shift(); this.tilt = state.shift();
        this.translate = [state.shift(),state.shift(),state.shift()];
        this.sword.rotation = [state.shift(), state.shift(), state.shift(), state.shift(), state.shift()];
        this.sword.position = [state.shift(), state.shift(), state.shift()];
    }
}
var text = {
    currentText : "",
    speaker : "",
    isTalking : true,
    finishedBox : false,
    transparency : 0,
    slice : 0,
    allowMove : false,
    
    index : 0,
    amount : 0,
    currentBox : 0,
    finished : false,
    scrolltimer : 0,
    initiate : function(amount) {
        this.speaker = allText[stage[1]][this.index][0];
        this.currentText = this.processText(allText[stage[1]][this.index][1]);
        this.allowMove = allText[stage[1]][this.index][2];
        this.amount = amount;
        this.slice = 0;
        this.finishedBox = false;
        this.transparency = 0;
        this.isTalking = true;
    },
    scroll : function(delta) {
        if (this.slice > this.currentText.length-2) {
            this.finishedBox = true;
            this.transparency += delta*4;
        } else {
            this.scrolltimer+=delta;
            if (this.currentText.charAt(this.slice-1) == '.' || this.currentText.charAt(this.slice-1) == ',' || this.currentText.charAt(this.slice-1) == '?' || this.currentText.charAt(this.slice-1) == '!') {
                var time = 0.4;
                if (this.currentText.charAt(this.slice-1) == ',') {
                    time = 0.3;
                }
                if (this.scrolltimer > time) {
                    this.slice++;
                    
                }
            } else if (/\s/.test(this.currentText.charAt(this.slice))) {
                this.slice+=1;
                this.scrolltimer = 0;
            } else {
                if (this.scrolltimer > 0.03) {
                    this.slice++;
                    this.scrolltimer = 0;
                }
            }
        }
    },
    next : function() {
        this.index++;
        this.amount--;
        if (this.index < allText[stage[1]].length && this.amount > 0) {
            this.speaker = allText[stage[1]][this.index][0];
            this.currentText = this.processText(allText[stage[1]][this.index][1]);
            this.allowMove = allText[stage[1]][this.index][2];
            this.finishedBox = false;
        } else {
            this.finished = true;
            this.isTalking = false;
            this.allowMove = true;
        }
        this.slice = 0;
        this.transparency = 0;
    },
    processText : function(text) {
        ctx.font = "21px 'Source Code Pro', monospace";
        var words = text.split(' ');
        var reconstruct = ""; var linelength = 0;
        for (var i = 0; i < words.length; i++) {
            linelength += ctx.measureText(words[i]+" ").width;
            if (linelength > 520) {
                reconstruct+="\n";
                linelength = ctx.measureText(words[i]+" ").width;
            } 
            reconstruct+=words[i]+" ";
        }
        return reconstruct;
    }
}
var allText = getText();
player.stop = player.angleState();
player.applyState(player.stop);
player.run(0.35/2);
player.running[0] = player.angleState();
player.applyState(player.stop);
player.run(0.35*3/2);
player.running[1] = player.angleState();
player.applyState(player.stop);
player.jump(0);
player.nJump = player.angleState();
player.applyState(player.stop);

var rooms = generateRooms();

//vertice arrays for certain things
var vertexArrays = {
    iris : generateIris(0.35, 10, 0.2), //generates a polygon in xy plane centered around (0,0) with specified radius and vertices
}

//VARIABLES FOR SETTINGS LATER?
var FOV = 60/180 * Math.PI, zNear = 1, zFar = 6000;

//timer variables and other
var then = -1; var angle = degToRad(180); var lastAngle = 0; var t = 0; var pastMove = "stop"; var time = 0; var jumpact = false; 
var swipe = -1; var swipeduration = 1/5; var swiping = false; var change = [];
var stage = [0,0];
var pastRoom = -1;
var particles = [];
var timer = 0; var lvltimer = 0;
function physics(now) {
    window.requestAnimationFrame(physics);
    if (then == -1) { then = now; }
    var delta = (now-then)*0.001;//angle+=delta; 
    time += delta;
    then = now;
    gl.uniform1f(u_alpha,1);

    var resolution = [1920, window.innerHeight/UI.scale];
    ctx.clearRect(0,0,resolution[0],resolution[1]);

    gl.enable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST);

    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    var perspective = computePerspectiveMatrix(FOV, zNear, zFar);
    perspective = targetCamera(perspective);
    if (player.tension != 1) {
        if (stage[1] == 0) {
            if (room0(delta)) {
                stage[1] += 1;
            }
        } else if (stage[1] == 1) {
            if (room1(delta,perspective,resolution)) {
                stage[1] += 1;
            }
        }
        if (player.tension < 1) {
            player.tension = Math.max(player.tension-delta*0.2,0);
        } else {
            player.tension = 1;
        }
    } else {
        dead();
        lvltimer = 0;
    }
    text.scroll(delta);
    renderUI();
    
}
function dead() {

}
function room1(delta,perspective,resolution) {
    if (pastRoom != 1) {
        time = 0; timer = 3;
        pastRoom = 1;
        sword.activated = 0;
        text.index = 0;
        text.initiate(16);
        text.finished = false;
    }
    if (timer > 0) {
        timer -= delta;
    }
    
    movement(delta);
    //attack
    if (keys['KeyQ'] && text.allowMove && !sword.activated && text.index == 15) {
        sword.activated = true;
        if (text.isTalking) {
            text.next();
        }
        text.initiate(5);
    }
    if (text.index > 20 && !text.isTalking) {
        lvltimer += delta;
        
    }
    if (sword.activated) {
        slash(delta);
    }
    makeEnemies(delta);
    renderParticles(delta);
    //rendering
    //player.run(t);
    renderPlayer(perspective);

    renderRoom(stage, perspective);

    /*gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    var identity = m4.scaling(1/window.innerWidth*2, -1/window.innerHeight*2, 1);
    identity = m4.translate(identity,-window.innerWidth/2,-window.innerHeight/2,0);

    gl.uniformMatrix4fv(u_matrixL, false, identity);*/
    
}
function room0(delta) {
    if (pastRoom != 0) {
        time = 0; timer = 0;
        pastRoom = 0;
        text.initiate(5);
    }
    if (!text.isTalking  && text.transparency > 4 && timer ==0) {
        text.initiate(5);   
    }    
    if (text.index == 10) {
        timer += delta;
        if (timer > 3) {
            return true;
        }
    }
    return false;
}
var enemyspawn = 1;
function makeEnemies(delta) {
    /*enemyspawn-=delta;
    if (enemyspawn <= 0) {
        enemyspawn = 1;
        var randomVec = [Math.random()*40-20,Math.random()*40-20];
        rooms[stage[1]].addBlock(new block(100,100,100,[-50,-88,-1000],boxColors([204, 204, 31],[217, 155, 0],[196, 209, 15],[0,0,0],[144, 20, 153],[209, 89, 15]),true,randomVec[0],randomVec[1],false));
    }*/
}
function startGame() {
    window.requestAnimationFrame(physics);
}
startGame();
function renderUI() {
    
    var resolution = [1920, window.innerHeight/UI.scale];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(UI.scale,UI.scale);
    if (stage[1] > 0) {
        ctx.fillStyle = 'rgba(48, 255, 231,'+(Math.sin(time*2)*0.1+0.3)+')';
        ctx.fillRect(40,resolution[1]/2-150,50,300);
        ctx.beginPath();
        ctx.moveTo(40,resolution[1]/2-150);
        ctx.lineTo(40,resolution[1]/2-200);
        ctx.lineTo(90,resolution[1]/2-150);
        ctx.fill();
        ctx.closePath();

        

        ctx.fillStyle = 'rgba(48,20,20,0.3)';
        ctx.fillRect(50,resolution[1]/2-140,30,280);


        ctx.fillStyle= 'rgb(66, 245, 209)';
        ctx.fillRect(50,resolution[1]/2+140-280*player.tension,30,280*player.tension);

        ctx.fillStyle = 'rgb(48,255,200)';
        ctx.font = "20px 'Source Code Pro', monospace";
        ctx.fillText('Tension',42,resolution[1]/2-150);
    }
    if (text.isTalking) {
        ctx.fillStyle = 'rgba(48, 255, 231,'+(Math.cos(time*2)*0.1+0.3)+')';
        ctx.beginPath();
        ctx.moveTo(resolution[0]/2-300,resolution[1]-250);
        ctx.lineTo(resolution[0]/2+270,resolution[1]-250);
        ctx.lineTo(resolution[0]/2+300,resolution[1]-220);
        ctx.lineTo(resolution[0]/2+300,resolution[1]-50);
        ctx.lineTo(resolution[0]/2-300,resolution[1]-50);
        ctx.fill();
        ctx.closePath();
        ctx.fillStyle = 'rgba(48,20,20,0.3)';
        ctx.fillRect(resolution[0]/2-290,resolution[1]-210, 580, 150);

        ctx.fillStyle = 'rgb(48,255,200)';
        ctx.font = "26px 'Source Code Pro', monospace";
        ctx.fillText(text.speaker,resolution[0]/2-290,resolution[1]-220);

        ctx.font = "21px 'Source Code Pro', monospace";
        var texts = text.currentText.slice(0,text.slice).split('\n');
        for (var i = 0; i < texts.length; i++) {
            ctx.fillText(texts[i], resolution[0]/2-280,resolution[1]-180+i*34);
        }
        ctx.fillStyle = 'rgba(48,255,200,'+Math.min(text.transparency, 0.7)+')';
        ctx.beginPath();
        var yMove = -Math.sin(text.transparency*1.3)*3-5;
        ctx.moveTo(resolution[0]/2+260,resolution[1]-80+yMove);
        ctx.lineTo(resolution[0]/2+250,resolution[1]-90+yMove);
        ctx.lineTo(resolution[0]/2+270,resolution[1]-90+yMove);
        ctx.fill();
        ctx.closePath();
        ctx.fillRect(resolution[0]/2+250,resolution[1]-77,20,5)
    }
    if (lvltimer > 0) {
        ctx.font = "50px 'Source Code Pro', monospace";
        ctx.fillStyle = 'rgba(48, 255, 231,'+(Math.cos(time*2+1)*0.1+0.3)+')';
        ctx.beginPath();
        ctx.moveTo(resolution[0]-20,20);
        ctx.lineTo(resolution[0]-20,70);
        ctx.lineTo(resolution[0]-70,20);
        ctx.fill();
        ctx.closePath();
        ctx.fillRect(resolution[0]-200,20,180,60);
        ctx.fillStyle = 'rgb(48,255,200)';
        ctx.fillText(lvltimer.toFixed(1),resolution[0]-190,65);
        ctx.font = "20px 'Source Code Pro', monospace";
        ctx.fillText('time',resolution[0]-180,25);
    }
    ctx.fillStyle = 'rgba(255,255,255,'+timer/3+')';
    ctx.fillRect(0,0,resolution[0],resolution[1]);
}
function renderRoom(room, perspective) {
    gl.uniform1f(u_alpha,1);
    gl.uniformMatrix4fv(u_matrixL, false, perspective);
    rooms[stage[1]].renderRoom(perspective);
    
    /*room = [rooms[0][room[0]][room[1]],rooms[1][room[0]][room[1]]];
    loadposcol(room[0],room[1]);
    gl.uniformMatrix4fv(u_matrixL, false, perspective);
    drawArrays(gl.TRIANGLES,0,room[0].length/3);*/
}
function renderParticles(delta) {
    
}
function movement(delta) {
    //movement
    var move = [0,0];
    if (keys["KeyW"]) { move[1] -= 1; }
    if (keys["KeyA"]) { move[0] -= 1; }
    if (keys["KeyS"]) { move[1] += 1; }
    if (keys["KeyD"]) { move[0] += 1; }
    var isMove = move[0]**2+move[1]**2 > 0;
    move = [move[0]*Math.cos(-camera.angleY)-move[1]*Math.sin(-camera.angleY), move[0]*Math.sin(-camera.angleY)+move[1]*Math.cos(-camera.angleY)];
    move = normalize(move,player.accel*delta);
    if (!text.allowMove) {
        move = [0,0];
        isMove = false;
    }
    var move2 = [...move];
    if (player.grounded) {
        player.movement[0] += move[0];
        player.movement[2] += move[1];
        var dist = Math.sqrt(player.movement[0]**2+player.movement[2]**2);
        if (dist > player.msp*delta) {
            move = normalize([player.movement[0],player.movement[2]],player.msp*delta);
            player.movement[0] = move[0];
            player.movement[2] = move[1];
        }
        var friction = normalize([player.movement[0],player.movement[2]],-Math.min(frictionc*delta,dist));
        player.movement[0]+=friction[0];
        player.movement[2]+=friction[1];

        dist = Math.sqrt(player.vector[0]**2+player.vector[2]**2);
        friction = normalize([player.vector[0],player.vector[2]],-Math.min(frictionc*delta,dist))
        player.vector[0]+=friction[0];
        player.vector[2]+=friction[1];
    }
    
    change = addVec3(player.movement,player.vector)
    player.pos = addVec3(player.pos, change);
    var collided = rooms[stage[1]].playerCollision;
    player.tension += delta*collided;
    player.grounded = player.pos[1] <= player.groundY+47.7*u;
    //player.jump(time);
    if (player.grounded && !jumpact) {
        if (isMove) {
            if (player.jumpQueue > 0) {
                player.jumpQueue = 0;
                pastMove = "mJump";
                jumpact = true;
                transition.initialize(player.angleState(), player.nJump, 0, 1/16);
                //pastMove == "mJump";
            } else {
                var dif = angleDif(angle, Math.atan2(-move2[0],-move2[1]));
                var min = Math.min(Math.abs(dif), player.turnspeed*delta);
                
                angle = (angle+min*Math.sign(dif))%(2*Math.PI);
                if (pastMove != "run") {
                    if (Math.sign(dif) == -1) {
                        player.stepstate = 0;
                    } else {
                        player.stepstate = 1;
                    }
                    transition.initialize(player.angleState(),player.running[player.stepstate], 0, 1/9);
                    pastMove = "run";
                } else {
                    if (!transition.finished) {
                        transition.go(delta);
                        if (player.stepstate == 0) {
                            t = 0.35*0.5;
                        } else {
                            t = 0.35*1.5;
                        }
                    } else {
                        t += delta;
                        player.run(t);
                    }
                }
            }
        } else {
            if (player.jumpQueue > 0) {
                player.jumpQueue = 0;
                if (pastMove != "nJump") {
                    pastMove = "nJump";
                    jumpact = true;
                    transition.initialize(player.angleState(), player.nJump, 0, 1/16);
                }
            } else {
                if (pastMove != "stop") {
                    transition.initialize(player.angleState(), player.stop, 0, 1/8);
                    pastMove = "stop";
                } else {
                    if (!transition.finished) {
                        transition.go(delta);
                    }
                    
                }
            }
        }
    } else {
        if (player.jumpQueue > 0) {
            player.jumpQueue -= delta;
        }
        /*var dif = angleDif(angle, Math.atan2(-change[0],-change[2]));
        var min = Math.min(Math.abs(dif), player.turnspeed*delta/3);
        
        angle = (angle+min*Math.sign(dif))%(2*Math.PI);*/
    }
    if (pastMove == "nJump") {
        if (!transition.finished) {
            transition.go(delta);
            t = 0;
        } else {
            player.jump(t);
            
            t+=delta;
            if (t > 0.1 && jumpact) {
                jumpact = false;
                player.vector[1] += player.jumpStrength*(Math.sqrt(1/(delta*60))*delta);
            }
            if (t > 0.1 && t < 0.4) {
                player.tension += 0.7*delta;
            }
        }
    }
    if (pastMove == "mJump") {
        if (!transition.finished) {
            transition.go(delta);
            t = 0;
        } else {
            player.jump(t);
            t+=delta;
            if (t > 0.1 && jumpact) {
                jumpact = false;
                player.vector[1] += player.jumpStrength*(Math.sqrt(1/(delta*60))*delta);
            }
            if (t > 0.1 && t < 0.4) {
                player.tension += 0.9*delta;
            }
        }
    }
    
    
    player.vector[1] -= 0.3*delta*60;
    if (player.pos[1] <= player.groundY+47.7*u && player.vector[1] < 0) {
        player.vector[1] = 0;
        player.pos[1] = player.groundY+47.7*u;
    }
    player.pos[1] += player.vector[1];
    //player.pos[1] = Math.min(Math.max(player.pos[0]))
}
function slash(delta) {
    player.sword.baseangle = angle;
    if (swipe <= 0) {
        if (swiping) {
            swiping = false;
            swordtransition.initialize(sword.angleState(),sword.idlestate(),0,1/2);
        } else {
            if (!swordtransition.finished) {
                swordtransition.finalPos = sword.idlestate();
                swordtransition.go(delta);
            } else {
                swipe = -1;
                sword.idle();
            }
        }
    } else {
        if (!swiping) {
            swiping = true;
            sword.anglecopy = sword.baseangle;
            swordtransition.initialize(sword.angleState(),sword.slashstate(),0,1/8);
        } else {
            if (!swordtransition.finished) {
                swordtransition.go(delta);
            } else {
                swipe = Math.max(swipe-delta,0);
                sword.slash(1-swipe/swipeduration);
                player.tension += delta*0.9;
            }
        }
    }
}
function renderPlayer(perspective) {
    
    var side = 10*pscale;
    var coords = player.getCoords();
    
    var translation = m4.translate(perspective,player.pos[0]+player.translate[0],player.pos[1]+player.translate[1],player.pos[2]+player.translate[2]);
    var full1 = [...translation];
    var full = m4.yRotate(translation, angle);
    
    full = m4.xRotate(full, -player.tilt);
    full = m4.translate(full,0,14.5*u,0);

    //make cube head
    var matrix = m4.xRotate(full,degToRad(-54.73561));
    matrix = m4.yRotate(matrix, degToRad(45));

    loadposcol(getCube(), getCubeColors());

    matrix = m4.scale(matrix,side,side,side); 
    matrix = m4.translate(matrix,-0.5,-0.5,-0.5);
    gl.uniformMatrix4fv(u_matrixL, false, matrix);

    drawArrays(gl.TRIANGLES, 0, 6*6);

    //eyes
    gl.disable(gl.CULL_FACE);
    loadposcol(vertexArrays.iris[0],vertexArrays.iris[1]);
    drawArrays(gl.TRIANGLES, 0, 180);

    //make body
    loadposcol(coords[0],
        [
            244,20,255,
            244,20,255,
            

            244,20,255,
            244,20,255,
            0,255,255,
            0,255,255,
            
            244,20,255,
            244,20,255,
            0,255,255,
            0,255,255,

            244,20,255,
            244,20,255,
            40,255,255,
            40,255,255,
            66, 164, 245,
            66, 164, 245,

            244,20,255,
            244,20,255,
            40,255,255,
            40,255,255,
            66, 164, 245,
            66, 164, 245,
        ]
    );
    gl.uniformMatrix4fv(u_matrixL, false, full);
    drawArrays(gl.LINES, 0, 22);
    loadposcol(coords[1],
        [
            //arm left
            40,255,255,
            40,255,255,
            40,255,255,

            //arm right
            40,255,255,
            40,255,255,
            40,255,255,

            //leg left
            40,255,255,
            40,255,255,
            40,255,255,

            66, 164, 245,
            66, 164, 245,
            66, 164, 245,

            66, 164, 245,
            66, 164, 245,
            66, 164, 245,

            //leg right
            40,255,255,
            40,255,255,
            40,255,255,

            66, 164, 245,
            66, 164, 245,
            66, 164, 245,

            66, 164, 245,
            66, 164, 245,
            66, 164, 245,
        ]); drawArrays(gl.TRIANGLES, 0, 3*8);
    gl.enable(gl.CULL_FACE);
    sword.render(full1);
}

function resize() {
    //gl.viewport(0,0,gl.canvas.clientWidth,gl.canvas.clientHeight);

    UI.scale = window.innerWidth/1920;
    
    webglUtils.resizeCanvasToDisplaySize(canvas, window.devicePixelRatio);
    canvas.width = window.innerWidth;
    canvas.height =window.innerHeight;
    gl.viewport(0,0,gl.canvas.clientWidth, gl.canvas.clientHeight);
    webglUtils.resizeCanvasToDisplaySize(UIcanvas, window.devicePixelRatio);
    UIcanvas.width = window.innerWidth;
    UIcanvas.height = window.innerHeight;

    /*if (settings.resolutionstate == 0) {
        if (window.innerWidth < 1920 && window.innerWidth > 1000) {
            xres = window.innerWidth;
        } else if (window.innerWidth <= 1200) {
            xres = 1200;
        } else {
            xres = 1920;
        }
    } else {
        xres = settings.resolutionstate;
    }
    if (Math.floor(window.innerHeight/window.innerWidth*xres) > 1080) {
        xres = Math.floor(window.innerWidth/window.innerHeight*1080);
    }
    resolution = [xres,Math.floor(window.innerHeight/window.innerWidth*xres)];*/
}
function addNewEvents() {
    window.addEventListener('resize',resize);
    
    window.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
    window.addEventListener('keydown', function(e) {
        keys = (keys || []);
        keys[e.code] = true;
        if (e.code == 'Space') {
            player.jumpQueue = 0.1;
        }
        if (e.code == 'ShiftRight' || e.code == 'ShiftLeft') {
            if (text.finishedBox && text.isTalking && !(stage[1] == 1 && text.index == 15)) {
                text.next();
            } else {
                text.slice = text.currentText.length;
            }
        }
    });
    window.addEventListener('keyup', function(e) {
        keys[e.code] = false;
    });
    window.addEventListener('mousedown', function(e) {
        keys[e.button] = true;
        if (e.button == 0) {
            if (swipe == -1) {
                swipe = swipeduration;
                var thing = positiveMod(sword.baseangle-camera.angleY, 2*Math.PI)
                if (thing > Math.PI/2 && thing < 3*Math.PI/2) {
                    sword.swipeangle = Math.PI+Math.atan2(-e.pageY+window.innerHeight/2,-e.pageX+window.innerWidth/2);
                } else {
                    sword.swipeangle = Math.PI+Math.atan2(-e.pageY+window.innerHeight/2,e.pageX-window.innerWidth/2);
                }
            }
        }
        if (e.button == 2) {
            camera.drag = true;
        } //1 is middle button, 2 is right button
    });
    window.addEventListener('mouseup', function(e) {
        keys[e.button] = false;
        if (e.button == 2) {
            camera.drag =false;
        }
    });
    window.addEventListener('mousemove', function(e) {
        if (camera.drag) {
            camera.angleY = (camera.angleY-e.movementX/window.innerWidth*4)%(2*Math.PI);
            
            camera.angleX = Math.max(Math.min(camera.angleX+e.movementY/window.innerWidth*4,Math.PI/2-1),0.1);
        }
    });
}
function computeViewProjMatrix(fieldOfView, zNear, zFar, cameraPosition, objPosition) {
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix = m4.perspective(fieldOfView, aspect, zNear, zFar);
    var up = [0,1,0]; //default

    //cam pos and obj pos are both [X, Y, Z]
    var cameraMatrix = m4.lookAt(cameraPosition, objPosition, up);
    var viewMatrix = m4.inverse(cameraMatrix);

    return m4.multiply(projectionMatrix, viewMatrix);
}
function drawArrays(primitiveType, offset, count) {
    gl.drawArrays(primitiveType, offset, count);
}
function loadposcol(positions, colors) {
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions),gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(colors), gl.STATIC_DRAW);
}
function vertexAttribPointer(location, size, type, normalize, stride, offset) {
    gl.vertexAttribPointer(location, size, type, normalize, stride, offset);
}
function computePerspectiveMatrix(fieldOfView, zNear, zFar) {
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    return m4.perspective(fieldOfView, aspect, zNear, zFar);
}
function radToDeg(r) {
    return r * 180 / Math.PI;
}
  
function degToRad(d) {
    return d * Math.PI / 180;
}
function spherical(theta, phi, r) {
    return [r*Math.sin(phi)*Math.cos(theta),r*Math.sin(phi)*Math.sin(theta),r*Math.cos(phi)];
}
function addVec3(v1, v2) {
    return [v1[0]+v2[0],v1[1]+v2[1],v1[2]+v2[2]];
}
function scaleVec3(v1,s) {
    return [v1[0]*s,v1[1]*s,v1[2]*s];
}
function average(v1, v2) {

}
//rendering coords
function getCube() {
    return new Float32Array([
        // front
        0,   0,  0,
        0, 1,  0,
        1,   0,  0,
        0, 1,  0,
        1, 1,  0,
        1,   0,  0,
    
        // right side
        0, 0, 0,
        0, 0, 1,
        0, 1, 0,
        0, 1, 0,
        0, 0, 1,
        0, 1, 1,
        
        //left side
        1, 0, 0,
        1, 1, 0,
        1, 0, 1,
        1, 1, 0,
        1, 1, 1,
        1, 0, 1,
        
        //top side
        1,1,0,
        0,1,0,
        0,1,1,
        0,1,1,
        1,1,1,
        1,1,0,
    
        //bottom side
        1,0,0,
        0,0,1,
        0,0,0,
        0,0,1,
        1,0,0,
        1,0,1,
        
        //front side
        0,   0,  1,
        1,   0,  1,
        0, 1,  1,
        0, 1,  1,
        1,   0,  1,
        1, 1,  1,
        
      ]
    );
}
function getCubeColors() {
    return [
        // left column front
        130, 184, 237,
        130, 184, 237,
        130, 184, 237,
        130, 184, 237,
        130, 184, 237,
        130, 184, 237,

        // top rung front
        87, 167, 194,
        87, 167, 194,
        87, 167, 194,
        87, 167, 194,
        87, 167, 194,
        87, 167, 194,

        // middle rung front
        130, 184, 237,
        130, 184, 237,
        130, 184, 237,
        130, 184, 237,
        130, 184, 237,
        130, 184, 237,

        // left column back
        87, 165, 230,
      87, 165, 230,
      87, 165, 230,
      87, 165, 230,
      87, 165, 230,
      87, 165, 230,

        // top rung back
      87, 165, 230,
      87, 165, 230,
      87, 165, 230,
      87, 165, 230,
      87, 165, 230,
      87, 165, 230,

        // middle rung back
        87, 167, 194,
        87, 167, 194,
        87, 167, 194,
        87, 167, 194,
        87, 167, 194,
        87, 167, 194,];
}

function HUGEsword() {
    var a = [0,0,0], b = [0,0.2,-.1], c = [0,0.2,.1], d = [1,0,0], e = [1,0.2,-.1], f = [1,0.2,.1];
    var handle = [
        ...a,...b,...c,
        ...a,...c,...d,
        ...c,...f,...d,
        ...a,...d,...b,
        ...b,...d,...e,
        ...c,...b,...f,
        ...b,...e,...f,
        ...e,...d,...f,
    ];
    a = [1.2,-0.5,0], b = [1.2,0.5,-.2], c = [1.2,0.5,.2], d = [9,-0.5,0], e = [9,0.5,-.2], f = [9,0.5,.2];
    var blade = [
        ...a,...b,...c,
        ...a,...c,...d,
        ...c,...f,...d,
        ...a,...d,...b,
        ...b,...d,...e,
        ...c,...b,...f,
        ...b,...e,...f,
        ...e,...d,...f,
    ];
    a = [9,-0.5,0], b = [9,0.5,-.2], c = [9,0.5,.2]; d = [11 ,0.5 ,0];
    var tip = [
        ...a,...b,...c,
        ...a,...c,...d,
        ...a,...d,...b,
        ...b,...d,...c,
    ];
    return [[...handle,...blade,...tip],[...repeatColor([0,0, 0],60)]];
}
function generateRooms() {
    var rooms = ["FILLER",0];
    for (var i = 1; i < rooms.length; i++) {
        if (i == 1) {
            var blocks = [];
            //blocks.push(new block(100,100,100,[-50,-88,-1000],boxColors([204, 204, 31],[217, 155, 0],[196, 209, 15],[0,0,0],[144, 20, 153],[209, 89, 15]),true,0,0,false));

            rooms[i] = new room(2000,2000,2000, [-1000,-88,200], blocks,boxColors([181, 97, 60],[58, 53, 55],[202, 168, 76],[0,0,0],[82, 120, 61],[105, 143, 121]));
        }
    }
    return rooms;
    /*return [
        [
        //stage 0
        [
            //room 0,0
            [
                
            ],
            //room 0,1
            [
                ...generateBoxOutside(2000,2000,2000,-1000,-88,200,[0,0,0],0),
                ...generateBoxInside(100,100,100,-50,-88,-1000,[0,0,0],0)

            ]
        ]
        ],
        [
        //stage 0
        [
            //room 0,0
            [
                
            ],
            //room 0,1
            [
                ...boxColors([181, 97, 60],[58, 53, 55],[202, 168, 76],[0,0,0],[82, 120, 61],[105, 143, 121]),
                ...boxColors([204, 204, 31],[217, 155, 0],[196, 209, 15],[0,0,0],[144, 20, 153],[209, 89, 15])

            ]
        ]
        ],
        [
        //stage 0
        [
            //room 0,0
            [
                
            ],
            //room 0,1
            [
                ...boxColors([181, 97, 60],[58, 53, 55],[202, 168, 76],[0,0,0],[140, 145, 107],[105, 143, 121]),
                ...boxColors([204, 204, 31],[217, 155, 0],[196, 209, 15],[0,0,0],[144, 20, 153],[209, 89, 15])

            ]
        ]
        ],
    ];*/
}
function generateBoxInside(x,y,z,tx,ty,tz) {
    z = -z;
    var a = [tx,ty,tz], b = [x+tx,ty,tz], c = [x+tx,y+ty,tz], d = [tx,y+ty,tz], e = [tx,ty,z+tz], f = [x+tx,ty,z+tz], g = [x+tx,y+ty,z+tz], h = [tx,y+ty,z+tz];
    var vertices = [
        ...a,...b,...c,
        ...a,...c,...d,
        
        ...e,...a,...d,
        ...e,...d,...h,

        ...a,...f,...b,
        ...a,...e,...f,

        ...f,...c,...b,
        ...f,...g,...c,
        
        ...d,...c,...g,
        ...d,...g,...h,
        
        ...e,...g,...f,
        ...e,...h,...g,
    ];
    return vertices;
}
function generateBoxOutside(x,y,z,tx,ty,tz) {
    z = -z;
    var a = [tx,ty,tz], b = [x+tx,ty,tz], c = [x+tx,y+ty,tz], d = [tx,y+ty,tz], e = [tx,ty,z+tz], f = [x+tx,ty,z+tz], g = [x+tx,y+ty,z+tz], h = [tx,y+ty,z+tz];
    var vertices = [
        ...a,...c,...b,
        ...a,...d,...c,
        
        ...e,...d,...a,
        ...e,...h,...d,

        ...a,...b,...f,
        ...a,...f,...e,

        ...f,...b,...c,
        ...f,...c,...g,
        
        ...d,...g,...c,
        ...d,...h,...g,
        
        ...e,...f,...g,
        ...e,...g,...h
    ];
    return vertices;
}
function boxColors(front,left,right,top,bottom,back) {
    return [...repeatColor(front,6),
    ...repeatColor(left,6),
    ...repeatColor(bottom,6),
    ...repeatColor(right,6),
    ...repeatColor(top,6),
    ...repeatColor(back,6),];
}
function matmult(vector,matrix) {
    vector = [...vector,1];
    var vector2 = [...vector,1];
    for (var i = 0; i < 4; i++) {
        vector2[i] = vector[0]*matrix[0+i]+vector[1]*matrix[4+i]+vector[2]*matrix[8+i]+vector[3]*matrix[12+i];
    }
    return vector2.slice(0,3);
}
function matmult2(vertices, matrix) {
    for (var i = 0; i < vertices.length; i+=3) {
        var vertex = matmult(vertices.slice(i,i+3),matrix);
        vertices[i] = vertex[0];
        vertices[i+1] = vertex[1];
        vertices[i+2] = vertex[2];
    }
    return vertices;
}
function wierdx(angle) {
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    return [1,0,0,0,0,-s,c,0,0,-c,s,0,0,0,0,1];
}
function generateCircle(r,v) {
    var prevpoint = [r,0,0];
    var points = [];
    for (var i = 2*Math.PI/v; i <= 2*Math.PI; i+=2*Math.PI/v) {
        var point = [r*Math.cos(i), r*Math.sin(i), 0];
        points = [...points, ...point,...prevpoint, 0,0,0];
        prevpoint = [...point];
    }
    return points;
}
function generateIris(r,v,r2) {
    //left eye
    var lEye = generateCircle(r,v);
    var lp = generateCircle(r2,v);
    var mat = m4.translation(0.2,1.1,-0.1);
    mat = m4.xRotate(mat, 0.5); //degToRad(-54.73561)
    mat = m4.yRotate(mat, 0.4);
    lEye = matmult2(lEye, mat);
    mat = m4.multiply(m4.translation(0.1,-0,-0.07),mat);
    lp = matmult2(lp, mat);

    var rEye = generateCircle(r,v);
    var rp = generateCircle(r2, v);
    mat = m4.translation(1.1,1.1,0.8);
    mat = m4.zRotate(mat, 0.5);
    mat = m4.yRotate(mat,Math.PI/2-0.4);
    rEye = matmult2(rEye, mat);
    mat = m4.multiply(m4.translation(0.07,0,-0.1),mat);
    rp = matmult2(rp, mat);

    return [[...lEye,...rEye,...lp,...rp],[...repeatColor([56, 160, 255],15),...repeatColor([255,255,255],15),...repeatColor([56, 160, 255],15),...repeatColor([255,255,255],15),...repeatColor([0,0,0],60)]];
}
function repeatColor(color,amount) {
    var colors = [];
    for (var i = 0; i < amount; i++) {
        colors = colors.concat(color);
    }
    return colors;
}
function normalize(vector,scalar) {
    if (vector[0] != 0 || vector[1] != 0) {
        var angle = Math.atan2(vector[1],vector[0]);
        return [Math.cos(angle)*scalar,Math.sin(angle)*scalar];
    } else {
        return [0,0];
    }
}
function angleDif(a1, a2) { //where a1 subtracts a2
    var a = a2-a1;
    return positiveMod(a+Math.PI,2*Math.PI)-Math.PI;
}
function positiveMod(a, n) {
    return a-Math.floor(a/n)*n;
}
function targetCamera(perspective) {
    perspective = m4.xRotate(perspective,camera.angleX);
    perspective = m4.yRotate(perspective,-camera.angleY);
    var projection = Math.cos(camera.angleX)*camera.distance;
    var offset = [Math.cos(camera.angleY)*projection,Math.sin(camera.angleY)*projection];
    camera.pos[0] = player.pos[0]+offset[1];
    camera.pos[2] = player.pos[2]+offset[0];
    camera.pos[1] = camera.distance*Math.sin(camera.angleX)+player.pos[1];
    /*var offset = [Math.cos(camera.angleY)*camera.distance,Math.sin(camera.angleY)*camera.distance]; //z,x
    camera.pos[0] = player.pos[0]+offset[1];
    camera.pos[2] = player.pos[2]+offset[0];
    camera.pos[1] = camera.distance*Math.sin(camera.angleX)+player.pos[1];*/
    perspective = m4.translate(perspective,-camera.pos[0],-camera.pos[1],-camera.pos[2]);
    return perspective;
}
function makeParticles(x,y,z, amount, speed) {
    for (var i = 0; i < amount; i++) {
        var randomVec = [Math.random()-0.5,Math.random()-0.5,Math.random()-0.5];
        randomVec = scaleVec3(randomVec,speed*2);
        var t = Math.random()+0.2;
        particles.push([x,y,z,randomVec,randomVec,t, type]);

    }
    //randomVec = 
}
function clampOut(bound1,bound2,relatives) { //bound1 is player
    var pushVector = [0,0,0];
    var collision = true;
    var min = 0;
    for (var i = 0; i < bound1.length; i++) {
        if (bound1[i][1] > bound2[i][0] && bound1[i][0] < bound2[i][1]) {
        } else {
            collision = false;
        }
    }
    return collision;
}
function clampIn(bound1, bound2,relatives) { //bound1 is player
    var pushVector = [0,0,0];
    var collision = false;
    for (var i = 0; i < bound1.length; i++) {
        if (i != 1) {
            if (bound1[i][1] > bound2[i][1]) {
                player.pos[i] = relatives[i][0]+bound2[i][1];
                collision = true;
            } else if (bound1[i][0] < bound2[i][0]) {
                player.pos[i] = relatives[i][1]+bound2[i][0];
                collision = true;
            }
        }
    
    }
}
function absMin(a,b) {
    var min = Math.min(Math.abs(a),Math.abs(b));
    if (min == Math.abs(a)) {
        return a;
    } else {
        return b;
    }
}
function getText() {
    var allText = [
        [
            ['SYSTEM','. . . Booting up. (press shift to continue)', false],
            ['SYSTEM','. . . generating AI with tag #HUGE.', false],
            ['SYSTEM','Done.', false],
            ['SYSTEM','* Linking sensors.', false],
            ['SYSTEM','connected.', false],
            ['H2 :O', 'Yo, did it boot up yet?', false],
            ["H1", "Yeah, it opened its eyes.", false],
            ['H2 :P', 'Oh yeah. I forgot to check for that.', false],
            ['H1', '* sigh *', false],
            ['H1', "Ok, I'm enabling its visual systems.", false],
        ],
        [
            ['H2 ^.^',"AI #HUGE, Welcome to the testing facility!",false],
            ['H2 :o',"Oh yeah, you have no idea what that means.",false],
            ['H2 >:(',"I don't feel like explaining though. H1, you do it.",false],
            ['H1',"* sigh *",false],
            ['H1',"Here and all around the world, there are testing facilities set up. The purpose of these facilities? To pick and select the best AI fighters.", false],
            ['H1',"We have been generating and testing AI fighters for a while, but none have been able to pass the standard tests.", false],
            ['H2 >:(',"Yeah, that's cuz we're bad proctors.",false],
            ['H1',"No, we're not.",false],
            ['H2 >:V',"Bro, the last AI we proctored had a literal cannon. He would've been OP as heck, but of course we didn't know how to trigger his gun.",false],
            ['H1',"Ok, enough. Let's just get started with the test.",false],
            ['H1',"Basic controls are [WASD]. Jump with [SPACE]. You can also change camera angle by holding down right click.",true],
            ['H1',"The bar on the left is TENSION. You'll notice that when you jump, your TENSION goes up. ",true],
            ['H2 :O',"Yeah and Pro Tip: if your TENSION reaches its limit, you go poof! And you fail the test.",true],
            ['H1',"The testing facility is split up into rooms. In each room, you have to activate the next teleporter, which will take you to the next room.",true],
            ['DEV',". . . which is what you're supposed to do, but i didnt have time to make any of the rooms. :(",true],
            ['H1',"Anyways, let's get your weapon activated. This is a one time thing, but press [Q].",true],
            ['H2 :OOOOO',"YOOOOOOOOOOO",true],
            ['H2 :O', "A HUGE SWORD? THAT'S HOT", true],
            ['H1', "Ignore H2. Sure, a huge sword is cool, but its not going to be useful in certain situations.", true],
            ['H1', "Also, press left click to attack with the sword.", true],
            ['DEV', "aaaand thats it. Have fun testing the weapon, i guess. oh yeah and, there's a stopwatch that starts in the top right.", true],
        ]
    ];
    return allText;
    //room 1
}