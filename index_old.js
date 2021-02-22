function Renderer(gl, vertexSource, fragmentSource) {

	let shaderProgram

	const init = () => {
		const vertexShader = gl.createShader(gl.VERTEX_SHADER)
		gl.shaderSource(vertexShader, vertexSource)
		gl.compileShader(vertexShader)

		const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
		gl.shaderSource(fragmentShader, fragmentSource)
		gl.compileShader(fragmentShader)

		shaderProgram = gl.createProgram()
		gl.attachShader(program, vertexShader)
		gl.attachShader(program, fragmentShader)
		gl.bindAttribLocation(program, 0, 'position')
		gl.linkProgram(program)

		gl.detachShader(program, vertexShader)
		gl.detachShader(program, fragmentShader)

		gl.deleteShader(vertexShader)
		gl.deleteShader(fragmentShader)
	}

	const draw = (aspectRatio, spheres) => {

	}
}

function Filter(gl, fragmentSource) {

	let textureWidth = 0
	let textureHeight = 0
	let resized = true

	const init = () => {

	}

	const resize = (width, height) => {
		resized = true
		textureWidth = width
		textureHeight = height
	}

	const use = () => {

	}

	const draw = () => {

	}
}

function LavaLamp(canvas) {

	const gl = canvas.getContext('webgl')

	let blobProgram
	let aspectRatioUniform
	let aspectRatio
	let offsetUniform
	let smoothProgram

	let blobsFramebuffer
	let blobsResolution = {width: null, height: null}

	let prevTime = 0
	let mouseX = 0
	let mouseY = 0
	let blobs = []

	const init = () => {
		canvas.addEventListener('mousemove', (event) => {
			const rect = canvas.getBoundingClientRect()
			mouseX = ((event.clientX - rect.left) * 2 - rect.width) / rect.height
			mouseY = ((rect.bottom - event.clientY) * 2 - rect.height) / rect.height
		})

		gl.enable(gl.BLEND)
		gl.clearColor(0, 0, 0, 0)

		createPrograms()

		const squareBuffer = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, squareBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
		gl.enableVertexAttribArray(0)
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

		const blobsTexture = gl.createTexture()
		gl.activeTexture(gl.TEXTURE0)
		gl.bindTexture(gl.TEXTURE_2D, blobsTexture)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

		blobsFramebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, blobsFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, blobsTexture, 0);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null)
	}

	const createPrograms = () => {
		blobProgram = createProgram(
			`
				precision highp float;
				uniform float aspectRatio;
				uniform vec2 offset;

				attribute vec2 position;

				varying vec2 pointCoord;

				void main() {
					pointCoord = position;
					gl_Position = vec4(
						(position.x * 0.45 + offset.x) / aspectRatio,
						position.y * 0.45 + offset.y,
						0.0, 1.0
					);
				}
			`,
			`
				precision highp float;

				varying vec2 pointCoord;

				void main() {
					float distance = length(pointCoord);
					float strength = (1.0 - distance) * 2.0;
					gl_FragColor = vec4(1, 1, 1, strength);
				}
			`
		)
		blobProgram = createProgram(
			`
				precision highp float;
				uniform float aspectRatio;
				uniform vec2 offset;

				attribute vec2 position;

				varying vec2 pointCoord;

				void main() {
					pointCoord = position;
					gl_Position = vec4(
						(position.x * 0.2 + offset.x) / aspectRatio,
						position.y * 0.2 + offset.y,
						0.0, 1.0
					);
				}
			`,
			`
				precision highp float;

				varying vec2 pointCoord;

				void main() {
					float lengthSquared = dot(pointCoord, pointCoord);
					float distance = sqrt(lengthSquared);
					// gl_FragColor = vec4((pointCoord + vec2(1)) / 2.0, (sqrt(1.0 - lengthSquared) + 1.0)/2.0, sign(1.0 - distance));
					gl_FragColor = vec4(pointCoord, sqrt(1.0 - lengthSquared), sign(1.0 - distance));
				}
			`
		)

		gl.useProgram(blobProgram)
		aspectRatioUniform = gl.getUniformLocation(blobProgram, "aspectRatio")
		offsetUniform = gl.getUniformLocation(blobProgram, "offset")

		smoothProgram = createProgram(
			`
				precision highp float;
				attribute vec2 position;

				varying vec2 screenCoord;

				void main() {
					gl_Position = vec4(position, 0.0, 1.0);
					screenCoord = (position + vec2(1)) / 2.0;
				}
			`,
			`
				precision highp float;
				uniform sampler2D texture;

				varying vec2 screenCoord;

				void main() {
					float blob = clamp((texture2D(texture, screenCoord).a - 0.8) / 0.01, 0.0, 1.0);

					vec3 color1 = vec3(1.0, 0.94901960784, 0.50588235294);
					vec3 color2 = vec3(0.21176470588, 1.0, 0.90196078431);
					float colorPos = (screenCoord.y - 0.2) / 0.6;
					vec3 color = mix(color1, color2, colorPos);

					vec3 background1 = vec3(0.45490196078, 0.73725490196, 1.0);
					vec3 background2 = vec3(0.21176470588, 1.0, 0.90196078431);
					float backgroundPos = (screenCoord.x + screenCoord.y) / 2.0;
					vec3 background = mix(background1, background2, backgroundPos);

					gl_FragColor = vec4(mix(background, color, blob), 1);
				}
			`
		)
		smoothProgram = createProgram(
			`
				precision highp float;
				attribute vec2 position;

				varying vec2 screenCoord;

				void main() {
					gl_Position = vec4(position, 0.0, 1.0);
					screenCoord = (position + vec2(1)) / 2.0;
				}
			`,
			`
				precision highp float;
				uniform sampler2D texture;

				varying vec2 screenCoord;

				void main() {
					gl_FragColor = vec4(vec3(texture2D(texture, screenCoord)), 1);
				}
			`
		)

		gl.useProgram(smoothProgram)
		gl.uniform1i(gl.getUniformLocation(smoothProgram, "texture"), 0)
	}

	const createProgram = (vertexSource, fragmentSource) => {
		const vertexShader = gl.createShader(gl.VERTEX_SHADER)
		gl.shaderSource(vertexShader, vertexSource)
		gl.compileShader(vertexShader)

		const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
		gl.shaderSource(fragmentShader, fragmentSource)
		gl.compileShader(fragmentShader)

		const program = gl.createProgram()
		gl.attachShader(program, vertexShader)
		gl.attachShader(program, fragmentShader)
		gl.bindAttribLocation(program, 0, 'position')
		gl.linkProgram(program)

		gl.detachShader(program, vertexShader)
		gl.detachShader(program, fragmentShader)

		gl.deleteShader(vertexShader)
		gl.deleteShader(fragmentShader)

		return program
	}

	const update = (timeMillis) => {
		const time = timeMillis / 1000
		let deltaTime = time - prevTime
		if (deltaTime > 0.5) deltaTime = 0;
		prevTime = time

		resize()

		const blobFramebufferScale = 1
		const preferredWidth = Math.floor(canvas.width * blobFramebufferScale)
		const preferredHeight = Math.floor(canvas.height * blobFramebufferScale)
		if (blobsResolution.width !== preferredWidth || blobsResolution.height !== preferredHeight) {
			blobsResolution.width = preferredWidth
			blobsResolution.height = preferredHeight
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, blobsResolution.width, blobsResolution.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, blobsFramebuffer);
		gl.viewport(0, 0, blobsResolution.width, blobsResolution.height);

		gl.clear(gl.COLOR_BUFFER_BIT)

		gl.useProgram(blobProgram)
		const preferredAspectRatio = blobsResolution.width / blobsResolution.height
		if (aspectRatio !== preferredAspectRatio) {
			aspectRatio = preferredAspectRatio
			gl.uniform1f(aspectRatioUniform, aspectRatio)
		}

		gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA) // TODO: Remove
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
		console.log(blobs)

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas.width, canvas.height);

		gl.useProgram(smoothProgram)
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
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
