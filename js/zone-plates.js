// Declaration and initialization of global variables
var sourcePos = { x: 0, y: 0, z: 0 };
var wavelength = 633e-9; // Initialize wavelength as 633 nanometers
var laserRGB = [0.0, 0.0, 0.0];
var pixelPitch = 10e-6; // Initialize pixel pitch as 10 micrometers
var canvas = null;
var gl = null;
var zonePlateShader = null;

// Conversion constants
var nm = 1e-9; // Conversion factor from nanometers to meters
var µm = 1e-6; // Conversion factor from micrometers to meters
//var nm2px = 480 / 127e6; // Conversion factor from nanometers to standard pixels (96 dpi);

window.onload = init;

function init() {
	canvas = document.getElementById( "glcanvas" ); // Chrome doesn't seem to support defer properly?!
	console.log( canvas );
	initGL();
	initSliders(); // Setup sliders' event handlers
	updateSlider( document.getElementById( "r-slider" ), false ); // This also updates the xyz sliders
	updateSlider( document.getElementById( "w-slider" ), false );
	paintCanvas();
}

function paintCanvas() {
	// Start the timer
	var start = new Date();

	connectUniforms( gl, zonePlateShader );
	gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

	// Calculate and display elapsed time
	var now = new Date();
	var elapsed = document.getElementById( "duration" );
	elapsed.textContent = ( now - start ) + ' ms';
}

function initGL() {
	// Get the WebGL context from the canvas
	try { gl = canvas.getContext( "webgl" ) } catch( ex ) { console.log( "ERROR: " + ex ); }
	if ( !gl ) { console.log( "Unable to initialize WebGL. Your browser may not support it." ); return; }

	// Setup the shader program with the vertex shader and the fragment shader
	zonePlateShader = setupShader( gl,
		// Vertex shader
		"attribute vec2 a_Position;" +
		"void main() { gl_Position = vec4( a_Position, 0.0, 1.0 ); }",
		// Fragment shader
		"precision highp float;" +
		"uniform vec2 u_CanvasSize;" + // Needs to be a float because it will be used in a division operation
		"uniform float u_PixelPitch;" +
		"uniform float u_Wavelength;" +
		"uniform vec3 u_LaserColor;" +
		"uniform vec3 u_sourcePos;" +
		"void main() {" +
		"  const int x=0; const int y=1; const int z=2;" + // Aliases for intuitive indexing of 3D spatial vectors
		"  const int R=0; const int G=1; const int B=2;" + // Aliases for intuitive indexing of 3D color vectors
		"  const float tau = 6.283185307179586476925286766559;" + // One full turn, measured in radians. See http://tauday.com/tau-manifesto
		"  vec3 holoP = vec3( gl_FragCoord.xy - u_CanvasSize / 2.0, 0.0 ) * u_PixelPitch;" + // 3D position of the current pixel, in meters, shifted so the origin is at the center of the canvas

		//"  float dist = distance( holoP, u_sourcePos );" +
		//"  float phaseDiff = dist - u_sourcePos[z];" + // Calculate phase difference between center of zone plate and the current pixel
		//"  float cosTheta = u_sourcePos[z] / dist;" +
		//"  float sinTheta = sqrt( 1.0 - pow( cosTheta, 2.0 ) );" +
		//"  float amplitude;" +
		//"  if ( sinTheta < u_Wavelength / 2.0 * u_PixelPitch ) { amplitude = cos( tau / u_Wavelength * phaseDiff ); }" +
		//"  else { amplitude = 0.0; }" +
		"  float phaseDiff = distance( holoP, u_sourcePos ) - u_sourcePos[z];" + // Calculate phase difference between center of zone plate and the current pixel
		"  float amplitude = cos( tau / u_Wavelength * phaseDiff );" + // Core calculation of zone plate value for this pixel

		"  float c = ( 1.0 + amplitude ) / 2.0;" + // Normalize amplitude of cosine from [-1 ... +1] to [0 ... 1], so it can be used as a color value
		"  gl_FragColor = vec4( c * u_LaserColor[R], c * u_LaserColor[G], c * u_LaserColor[B], 1.0 );" +
		"}"
	);

	// Draw the object given a set of 2D points, in this case a square
	setupGeometry( gl, zonePlateShader );
}

function setupShader( gl, vertShaderSrc, fragShaderSrc ) {
	function buildShader( type, sourceCode ) {
		var sh;
		if ( type == "fragment" )
			sh = gl.createShader( gl.FRAGMENT_SHADER );
		else if ( type == "vertex" )
			sh = gl.createShader( gl.VERTEX_SHADER );
		else // Unknown shader type
			return null;
		gl.shaderSource( sh, sourceCode );
		gl.compileShader( sh );
		// See if it compiled successfully
		if ( !gl.getShaderParameter( sh, gl.COMPILE_STATUS ) ) {
			console.log( "An error occurred compiling the " + type +
			" shader: " + gl.getShaderInfoLog( sh ) );
			return null;
		} else { return sh; }
	} ;

	var prog = gl.createProgram();
	gl.attachShader( prog, buildShader( 'vertex', vertShaderSrc ) );
	gl.attachShader( prog, buildShader( 'fragment', fragShaderSrc ) );
	gl.linkProgram( prog );
	if ( !gl.getProgramParameter( prog, gl.LINK_STATUS ) ) {
		throw "Could not link the shader program!";
	}
	gl.useProgram( prog );
	return prog;
}

function setupGeometry( gl, shaderProgram ) {
	var vertexBuffer = gl.createBuffer();
	gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
	gl.bufferData( gl.ARRAY_BUFFER, new Float32Array([
		-1.0, -1.0,
		 1.0, -1.0,
		-1.0,  1.0,
		 1.0,  1.0
	]), gl.STATIC_DRAW );
	var positionPtr = gl.getAttribLocation( shaderProgram, "a_Position" );
	gl.enableVertexAttribArray( positionPtr );
	gl.vertexAttribPointer( positionPtr, 2, gl.FLOAT, false, 0, 0 );
}

function connectUniforms( gl, shaderProgram ) {
	var canvasSizePtr = gl.getUniformLocation( shaderProgram, "u_CanvasSize" );
	gl.uniform2f( canvasSizePtr, canvas.width, canvas.height );

	var wavelengthPtr = gl.getUniformLocation( shaderProgram, "u_Wavelength" );
	gl.uniform1f( wavelengthPtr, wavelength );

	var laserColorPtr = gl.getUniformLocation( shaderProgram, "u_LaserColor" );
	gl.uniform3f( laserColorPtr, laserRGB[0] / 255, laserRGB[1] / 255, laserRGB[2] / 255 );

	var pixelPitchPtr = gl.getUniformLocation( shaderProgram, "u_PixelPitch" );
	gl.uniform1f( pixelPitchPtr, pixelPitch );

	var sourcePosPtr = gl.getUniformLocation( shaderProgram, "u_sourcePos" );
	gl.uniform3f( sourcePosPtr, sourcePos.x, sourcePos.y, sourcePos.z );
}

function initSliders() {
	var sliders = document.querySelectorAll( "input[type=range]" );
	for ( s in sliders ) {
		if ( typeof( sliders[s] )==="object" ) {
			sliders[s].oninput = function( e ) { updateSlider( e.target, true ) };
		}
	}
}

function updateSlider( elem, paint ) {
	switch( elem.name ) {
		case "x":
			sourcePos.x = elem.value * canvas.width / 2 * pixelPitch; // Left of the canvas to right of the canvas
			document.getElementById( elem.name + "-show" ).innerHTML = ' ' + formatNumber( sourcePos.x * 1000 ) + ' mm';
			break;
		case "y":
			sourcePos.y = elem.value * canvas.height / 2 * pixelPitch // Bottom of the canvas to top of the canvas
			document.getElementById( elem.name + "-show" ).textContent = ' ' + formatNumber( sourcePos.y * 1000 ) + ' mm';
			break;
		case "z":
			sourcePos.z = Math.pow( elem.value, 4 ) * ( pixelPitch * canvas.width / 2 ) * 100; // Up to 2 orders of magnitude (100x) larger than the xy variation
			document.getElementById( elem.name + "-show" ).innerHTML = ' ' + formatNumber( sourcePos.z * 1000 ) + ' mm';
			break;
		case "w":
			wavelength = elem.value * nm; // 400 to 700 nm
			document.getElementById( elem.name + "-show" ).innerHTML = ' ' + formatNumber( wavelength / nm ) + '&#8202;&#8194;nm';
			laserRGB = nmToRGB( elem.value );
			break;
		case "r":
			pixelPitch = Math.pow( 10, elem.value ) * µm;
			var printTech = '';
			switch( Math.round( elem.value ) ) {
				case -1: printTech = 'electron beam lithography'; break;
				case  0: printTech = 'laser lithography'; break;
				case  1: printTech = 'imagesetter'; break;
				case  2: printTech = 'laser printer';
			}
			document.getElementById( elem.name + "-show" ).innerHTML = ' ' + formatNumber( pixelPitch / µm ) + '&#8202;&#8194;µm<br/>(' + printTech + ')';
			// Update scale indicator
			document.getElementById( "scale" ).textContent = formatNumber( canvas.width * pixelPitch * 1000 ) + ' mm';
			// Update xyz sliders, which depend on the resolution
			updateSlider( document.getElementById( "x-slider" ), false );
			updateSlider( document.getElementById( "y-slider" ), false );
			updateSlider( document.getElementById( "z-slider" ), false );
	}
	if( paint ) paintCanvas();
}

function formatNumber( n ) {
	return Number( n ).toFixed( 2 );
}

// Convert wavelength to RGB
// Code from http://academo.org/demos/wavelength-to-colour-relationship/animation.js,
// which in turn was adapted from http://www.efg2.com/Lab/ScienceAndEngineering/Spectra.htm
function nmToRGB( Wavelength ) {
	var Gamma = 0.80;
	var IntensityMax = 255;
	var factor;

	if( ( Wavelength >= 380 ) && ( Wavelength<440 ) ) {
		Red = -( Wavelength - 440 ) / ( 440 - 380 );
		Green = 0.0;
		Blue = 1.0;
	} else if( ( Wavelength >= 440 ) && ( Wavelength<490 ) ) {
		Red = 0.0;
		Green = ( Wavelength - 440 ) / ( 490 - 440 );
		Blue = 1.0;
	} else if( ( Wavelength >= 490 ) && ( Wavelength<510 ) ) {
		Red = 0.0;
		Green = 1.0;
		Blue = -( Wavelength - 510 ) / ( 510 - 490 );
	} else if( ( Wavelength >= 510 ) && ( Wavelength<580 ) ) {
		Red = ( Wavelength - 510 ) / ( 580 - 510 );
		Green = 1.0;
		Blue = 0.0;
	} else if( ( Wavelength >= 580 ) && ( Wavelength<645 ) ) {
		Red = 1.0;
		Green = -( Wavelength - 645 ) / ( 645 - 580 );
		Blue = 0.0;
	} else if( ( Wavelength >= 645 ) && ( Wavelength<781 ) ) {
		Red = 1.0;
		Green = 0.0;
		Blue = 0.0;
	} else{
		Red = 0.0;
		Green = 0.0;
		Blue = 0.0;
	};

	// Let the intensity fall off near the vision limits

	if( ( Wavelength >= 380 ) && ( Wavelength<420 ) ) {
		factor = 0.3 + 0.7 * ( Wavelength - 380 ) / ( 420 - 380 );
	} else if( ( Wavelength >= 420 ) && ( Wavelength<701 ) ) {
		factor = 1.0;
	} else if( ( Wavelength >= 701 ) && ( Wavelength<781 ) ) {
		factor = 0.3 + 0.7 * ( 780 - Wavelength ) / ( 780 - 700 );
	} else{
		factor = 0.0;
	};

	// Don't want 0^x = 1 for x <> 0
	if ( Red==0 ) { Red = 0 } else Red = Math.round( IntensityMax * Math.pow( Red * factor, Gamma ) );
	if ( Green==0 ) { Green = 0 } else Green = Math.round( IntensityMax * Math.pow( Green * factor, Gamma ) );
	if ( Blue==0 ) { Blue = 0 } else Blue = Math.round( IntensityMax * Math.pow( Blue * factor, Gamma ) );

	rgb = new Array( Red, Green, Blue );
	return rgb;
}
