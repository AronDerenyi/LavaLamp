function LavaLamp(canvas) {

	const gl = canvas.getContext('webgl')

	let ballProgram
	let aspectRatioUniform
	let aspectRatio
	let offsetUniform

	let blurXProgram
	let blurYProgram
	let filterProgram

	let blobsTexture
	let blobsFramebuffer

	let blurXTexture
	let blurXFramebuffer

	let blurYTexture
	let blurYFramebuffer

	let blobsResolution = {width: null, height: null}

	let prevTime = 0
	let mouseX = 0
	let mouseY = 0
	let blobs = []

	const init = () => {
		initMouse()
		initGeometry()

		createPrograms()
		createFramebuffers()
	}

	const initMouse = () => {
		canvas.addEventListener('mousemove', (event) => {
			const rect = canvas.getBoundingClientRect()
			mouseX = ((event.clientX - rect.left) * 2 - rect.width) / rect.height
			mouseY = ((rect.bottom - event.clientY) * 2 - rect.height) / rect.height
		})
	}

	const initGeometry = () => {
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
		gl.enableVertexAttribArray(0)
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
	}

	const createPrograms = () => {
		const ballVertexShader = createShader(`
			precision highp float;
			uniform float aspectRatio;
			uniform vec2 offset;

			attribute vec2 position;

			varying vec2 pointCoord;

			void main() {
				pointCoord = position;
				gl_Position = vec4(
					(position.x * 0.3 + offset.x) / aspectRatio,
					position.y * 0.3 + offset.y,
					0.0, 1.0
				);
			}
		`, gl.VERTEX_SHADER)

		const ballFragmentShader = createShader(`
			precision highp float;

			varying vec2 pointCoord;

			void main() {
				float lengthSquared = dot(pointCoord, pointCoord);
				float distance = sqrt(lengthSquared);
				vec3 normal = vec3(pointCoord, sqrt(1.0 - lengthSquared));
				gl_FragColor = vec4((normal + vec3(1)) * 0.5, (1.0 - distance) * 16.0);
			}
		`, gl.FRAGMENT_SHADER)

		ballProgram = createProgram(ballVertexShader, ballFragmentShader)
		aspectRatioUniform = gl.getUniformLocation(ballProgram, "aspectRatio")
		offsetUniform = gl.getUniformLocation(ballProgram, "offset")

		gl.deleteShader(ballVertexShader)
		gl.deleteShader(ballFragmentShader)

		const filterVertexShader = createShader(`
			precision highp float;
			attribute vec2 position;

			varying vec2 screenCoord;

			void main() {
				gl_Position = vec4(position, 0.0, 1.0);
				screenCoord = (position + vec2(1)) * 0.5;
			}
		`, gl.VERTEX_SHADER)

		const blurXFragmentShader = createShader(`
			precision highp float;
			uniform sampler2D texture;
			uniform float pixelSizeX;

			varying vec2 screenCoord;

			void main() {
				gl_FragColor = texture2D(texture, screenCoord) * 0.2270270270 +
					texture2D(texture, screenCoord - vec2(pixelSizeX * 1.3846153846, 0)) * 0.3162162162 +
					texture2D(texture, screenCoord + vec2(pixelSizeX * 1.3846153846, 0)) * 0.3162162162 +
					texture2D(texture, screenCoord - vec2(pixelSizeX * 3.2307692308, 0)) * 0.0702702703 +
					texture2D(texture, screenCoord + vec2(pixelSizeX * 3.2307692308, 0)) * 0.0702702703;
			}
		`, gl.FRAGMENT_SHADER)

		const blurYFragmentShader = createShader(`
			precision highp float;
			uniform sampler2D texture;
			uniform float pixelSizeY;

			varying vec2 screenCoord;

			void main() {
				gl_FragColor = texture2D(texture, screenCoord) * 0.2270270270 +
					texture2D(texture, screenCoord - vec2(0, pixelSizeY * 1.3846153846)) * 0.3162162162 +
					texture2D(texture, screenCoord + vec2(0, pixelSizeY * 1.3846153846)) * 0.3162162162 +
					texture2D(texture, screenCoord - vec2(0, pixelSizeY * 3.2307692308)) * 0.0702702703 +
					texture2D(texture, screenCoord + vec2(0, pixelSizeY * 3.2307692308)) * 0.0702702703;
			}
		`, gl.FRAGMENT_SHADER)

		const filterFragmentShader = createShader(`
			precision highp float;
			uniform sampler2D texture;

			varying vec2 screenCoord;

			void main() {
				vec4 texture = texture2D(texture, screenCoord);
				vec3 normal = normalize(texture.xyz * 2.0 - vec3(1));
				float visibility = texture.w * 100.0 - 80.0;
				// gl_FragColor = vec4((normal + vec3(1)) * 0.5, visibility);
				gl_FragColor = vec4(
					mix(
						vec3(1),
						vec3(dot(normal, normalize(vec3(0.3, 0.3, 1)))) * 0.4 + 0.5,
						clamp(visibility, 0.0, 1.0)
					),
					1
				);
			}
		`, gl.FRAGMENT_SHADER)

		blurXProgram = createProgram(filterVertexShader, blurXFragmentShader)
		blurYProgram = createProgram(filterVertexShader, blurYFragmentShader)
		filterProgram = createProgram(filterVertexShader, filterFragmentShader)

		pixelSizeXUniform = gl.getUniformLocation(blurXProgram, "pixelSizeX")
		pixelSizeYUniform = gl.getUniformLocation(blurYProgram, "pixelSizeY")

		gl.deleteShader(ballVertexShader)
		gl.deleteShader(blurXFragmentShader)
		gl.deleteShader(blurYFragmentShader)
		gl.deleteShader(filterFragmentShader)
	}

	const createShader = (source, type) => {
		const shader = gl.createShader(type)
		gl.shaderSource(shader, source)
		gl.compileShader(shader)
		return shader
	}

	const createProgram = (vertexShader, fragmentShader) => {
		const program = gl.createProgram()
		gl.attachShader(program, vertexShader)
		gl.attachShader(program, fragmentShader)
		gl.bindAttribLocation(program, 0, 'position')
		gl.linkProgram(program)

		gl.detachShader(program, vertexShader)
		gl.detachShader(program, fragmentShader)

		return program
	}

	const createFramebuffers = () => {
		blobsTexture = createTexture();
		blobsFramebuffer = createFramebuffer(blobsTexture);

		blurXTexture = createTexture();
		blurXFramebuffer = createFramebuffer(blurXTexture);

		blurYTexture = createTexture();
		blurYFramebuffer = createFramebuffer(blurYTexture);
	}

	const createTexture = () => {
		const texture = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, texture)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		gl.bindTexture(gl.TEXTURE_2D, null)
		return texture
	}

	const createFramebuffer = (texture) => {
		const framebuffer = gl.createFramebuffer()
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
		gl.bindFramebuffer(gl.FRAMEBUFFER, null)
		return framebuffer
	}

	const update = (timeMillis) => {
		const time = timeMillis / 1000
		let deltaTime = time - prevTime
		if (deltaTime > 0.5) deltaTime = 0;
		prevTime = time

		resize()

		const blobFramebufferScale = 0.1
		const preferredWidth = Math.floor(canvas.width * blobFramebufferScale)
		const preferredHeight = Math.floor(canvas.height * blobFramebufferScale)
		if (blobsResolution.width !== preferredWidth || blobsResolution.height !== preferredHeight) {
			blobsResolution.width = preferredWidth
			blobsResolution.height = preferredHeight
			gl.bindTexture(gl.TEXTURE_2D, blobsTexture)
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, blobsResolution.width, blobsResolution.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
			gl.bindTexture(gl.TEXTURE_2D, blurXTexture)
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, blobsResolution.width, blobsResolution.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
			gl.bindTexture(gl.TEXTURE_2D, blurYTexture)
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, blobsResolution.width, blobsResolution.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, blobsFramebuffer);
		gl.viewport(0, 0, blobsResolution.width, blobsResolution.height);

		gl.clearColor(0, 0, 0, 0)
		gl.clear(gl.COLOR_BUFFER_BIT)

		gl.useProgram(ballProgram)
		const preferredAspectRatio = blobsResolution.width / blobsResolution.height
		if (aspectRatio !== preferredAspectRatio) {
			aspectRatio = preferredAspectRatio
			gl.uniform1f(aspectRatioUniform, aspectRatio)
		}

		gl.enable(gl.BLEND)
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
		const rnd = random(0)
		const randomPosition = random(1000)
		const amount = Math.floor(aspectRatio / 0.1)
		blobs = blobs.slice(0, amount)
		for (let i = 0; i < amount; i++) {
			const frequencyX = rnd() * 3.14 * 0.02
			const frequencyY = rnd() * 3.14 * 0.10
			const offsetX = rnd() * 6.28
			const offsetY = rnd() * 6.28

			const desiredVX = Math.sin(time * frequencyX + offsetX) * frequencyX * deltaTime
			const desiredVY = Math.sin(time * frequencyY + offsetY) * frequencyY * deltaTime

			let blob
			if (blobs[i]) {
				blob = blobs[i]
			} else {
				blob = {x: (randomPosition() * 2 - 1) * aspectRatio, y: randomPosition() * 2 - 1, vx: 0, vy: 0}
				blobs[i] = blob
			}

			if (Math.abs(blob.vx) > 0.01) {
				blob.vx -= Math.sign(blob.vx) * 0.01
			} else {
				blob.vx = 0
			}

			if (Math.abs(blob.vy) > 0.01) {
				blob.vy -= Math.sign(blob.vy) * 0.01
			} else {
				blob.vy = 0
			}

			const [mouseDirX, mouseDirY, mouseDist] = normalize(blob.x, blob.y, mouseX, mouseY)
			const force = Math.max(0, 1 - mouseDist / 1) * 0.01
			blob.vx -= mouseDirX * force
			blob.vy -= mouseDirY * force

			blob.vx -= 1 / (-aspectRatio - 0.1 - blob.x) * 0.0002
			blob.vx -= 1 / (aspectRatio + 0.1 - blob.x) * 0.0002
			blob.vy -= 1 / (-1.1 - blob.y) * 0.0002
			blob.vy -= 1 / (1.1 - blob.y) * 0.0002

			// blob.vx += (desiredX - blob.x) * 0.01
			// blob.vx += (desiredY - blob.y) * 0.01

			blob.x += blob.vx + desiredVX
			blob.y += blob.vy + desiredVY

			if (blob.x < -aspectRatio - 0.1) blob.x = -aspectRatio - 0.1
			if (blob.x > aspectRatio + 0.1) blob.x = aspectRatio + 0.1
			if (blob.y < -1.1) blob.y = -1.1
			if (blob.y > 1.1) blob.y = 1.1

			gl.uniform2f(offsetUniform, blob.x, blob.y)
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
		}
		gl.disable(gl.BLEND)
		// console.log(blobs)

		gl.bindTexture(gl.TEXTURE_2D, blobsTexture)


		for (i = 0; i < 3; i++) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, blurXFramebuffer)
			gl.useProgram(blurXProgram)
			gl.uniform1f(pixelSizeXUniform, 1 / blobsResolution.width)
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
			gl.bindTexture(gl.TEXTURE_2D, blurXTexture)



			gl.bindFramebuffer(gl.FRAMEBUFFER, blurYFramebuffer)
			gl.useProgram(blurYProgram)
			gl.uniform1f(pixelSizeYUniform, 1 / blobsResolution.height)
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
			gl.bindTexture(gl.TEXTURE_2D, blurYTexture)
		}



		gl.viewport(0, 0, canvas.width, canvas.height)
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.useProgram(filterProgram)
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

		requestAnimationFrame(update)
	}

	const resize = () => {
		if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
			canvas.width = canvas.clientWidth
			canvas.height = canvas.clientHeight
		}
	}



	const random = (seed) => {
		return () => {
			let t = seed += 0x6D2B79F5;
			t = Math.imul(t ^ t >>> 15, t | 1);
			t ^= t + Math.imul(t ^ t >>> 7, t | 61);
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		}
	}

	const normalize = (x1, y1, x2, y2) => {
		if (x1 === x2 && y1 === y2) return [0, 0, 0]

		const distX = x2 - x1
		const distY = y2 - y1
		const dist = Math.sqrt(distX * distX + distY * distY)
		return [distX / dist, distY / dist, dist]
	}

	init()
	update(0)
}

/*

1
1 1
1 2 1
1 3 3 1
1 4 6 4 1
1 5 10 10 5 1
1 6 15 20 15 6 1 / 64
1 7 21 35 35 21 7 1
1 8 28 56 70 56 28 8 1 / 256

*/
