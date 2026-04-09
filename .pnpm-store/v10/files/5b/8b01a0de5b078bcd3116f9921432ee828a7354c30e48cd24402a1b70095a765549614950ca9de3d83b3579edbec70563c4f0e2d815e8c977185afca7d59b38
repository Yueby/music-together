"use strict";/*!
 * @pixi/filter-bulge-pinch - v5.1.1
 * Compiled Wed, 11 Jan 2023 23:10:33 UTC
 *
 * @pixi/filter-bulge-pinch is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */Object.defineProperty(exports,"__esModule",{value:!0});var c=require("@pixi/core"),d=`attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;

void main(void)
{
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
}`,u=`uniform float radius;
uniform float strength;
uniform vec2 center;
uniform sampler2D uSampler;
varying vec2 vTextureCoord;

uniform vec4 filterArea;
uniform vec4 filterClamp;
uniform vec2 dimensions;

void main()
{
    vec2 coord = vTextureCoord * filterArea.xy;
    coord -= center * dimensions.xy;
    float distance = length(coord);
    if (distance < radius) {
        float percent = distance / radius;
        if (strength > 0.0) {
            coord *= mix(1.0, smoothstep(0.0, radius / distance, percent), strength * 0.75);
        } else {
            coord *= mix(1.0, pow(percent, 1.0 + strength * 0.75) * radius / distance, 1.0 - percent);
        }
    }
    coord += center * dimensions.xy;
    coord /= filterArea.xy;
    vec2 clampedCoord = clamp(coord, filterClamp.xy, filterClamp.zw);
    vec4 color = texture2D(uSampler, clampedCoord);
    if (coord != clampedCoord) {
        color *= max(0.0, 1.0 - length(coord - clampedCoord));
    }

    gl_FragColor = color;
}
`;const n=class extends c.Filter{constructor(e){super(d,u),this.uniforms.dimensions=new Float32Array(2),Object.assign(this,n.defaults,e)}apply(e,r,o,i){const{width:s,height:a}=r.filterFrame;this.uniforms.dimensions[0]=s,this.uniforms.dimensions[1]=a,e.applyFilter(this,r,o,i)}get radius(){return this.uniforms.radius}set radius(e){this.uniforms.radius=e}get strength(){return this.uniforms.strength}set strength(e){this.uniforms.strength=e}get center(){return this.uniforms.center}set center(e){this.uniforms.center=e}};let t=n;t.defaults={center:[.5,.5],radius:100,strength:1},exports.BulgePinchFilter=t;
//# sourceMappingURL=filter-bulge-pinch.js.map
