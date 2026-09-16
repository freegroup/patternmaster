// Help texts for every adjustable value. Shown by the (?) badges next to the labels.
// Not a fetched .json — CORS blocks that on file://. Hence an object literal that can be
// edited just like JSON. The `description` field may contain arbitrary HTML.
//
// Key scheme:
//   Static fields    : the data-bind path            -> 'cam.feed'
//   Pattern params   : pattern.<patternId>.<param>   -> 'pattern.parallel.depth'
//   Cutter params    : tool.<toolId>.<param>         -> 'tool.vee.angle'
//   Select fields    : via data-help on the element  -> 'sel.pattern'
//   Fallback         : '*.<param>' applies when no exact key exists.
window.PM = window.PM || {};

PM.help = {

  // ---------------- Workpiece ----------------
  'work.w': { description: `
    <p>Width of the board along X, in millimetres.</p>
    <p>The origin <b>X0/Y0 sits at the bottom-left</b>, so the board spans <code>0</code> to
    <code>Width X</code> and the pattern fills exactly that.</p>
    <p class="hint">Set this to your real workpiece and zero the machine at the bottom-left
    corner of the board before you start the job.</p>` },

  'work.h': { description: `
    <p>Height of the board along Y, in millimetres.</p>
    <p>Together with <i>Width X</i> this defines the rectangle the generator textures —
    from <code>0</code> at the bottom up to <code>Height Y</code>.</p>` },

  'work.overshootX': { description: `
    <p>How far the paths <b>run past the left and right edges</b> of the board, in mm.</p>
    <p>Without overshoot every cut starts and ends <i>on</i> the board. That is exactly where
    the cutter pauses to change direction, which leaves visible entry marks along the edges.
    With overshoot it plunges beside the material and leaves it cleanly.</p>
    <p><b>Rule of thumb:</b> at least the cutter radius, typically 2–5&nbsp;mm.</p>
    <p class="warn">The space beside the workpiece has to be genuinely clear — use a sacrificial
    board underneath and watch out for clamps.</p>` },

  'work.overshootY': { description: `
    <p>How far the paths <b>run past the bottom and top edges</b>, in mm.</p>
    <p>Same effect as <i>Overshoot X</i>, but for the Y edges. Which one matters depends on the
    path angle: paths running along X spill over the X edges, diagonal paths over both.</p>
    <p><b>Rule of thumb:</b> at least the cutter radius, typically 2–5&nbsp;mm.</p>
    <p class="warn">The space beside the workpiece has to be genuinely clear — use a sacrificial
    board underneath and watch out for clamps.</p>` },

  // ---------------- Pattern ----------------
  'sel.pattern': { description: `
    <p>The texture that gets cut into the board.</p>
    <p>Every pattern has <b>its own set of settings</b>, so the fields below change when you pick
    a different one. Your settings for each pattern are remembered while you switch back and
    forth, so you can compare without losing your work.</p>` },

  'seed': { description: `
    <p>Picks one specific variation of the pattern.</p>
    <p>The same seed always gives you <b>exactly the same pattern</b> — so if you find a layout
    you like, note the number down and you can reproduce it any time, on any machine.</p>
    <p>Adjusting depth or length afterwards only changes those values; the <b>layout stays put</b>.
    You can fine-tune a variation you like without it scrambling on you.</p>
    <p class="hint">🎲 rolls a new variation.</p>` },

  'pattern.parallel.stepover': { description: `
    <p>Distance between two neighbouring paths, measured across the path direction.</p>
    <p>Smaller means denser and finer, but a markedly longer run time (the number of paths grows
    linearly). With a ball nose this value together with the cutter radius determines how high
    the ridges left standing between passes are.</p>` },

  'pattern.parallel.angle': { description: `
    <p>Direction of the bands, in degrees.</p>
    <p><code>0°</code> runs along X, <code>90°</code> along Y. Diagonal angles such as
    <code>30°</code> or <code>45°</code> often look livelier on figured wood, because the paths
    cross the grain.</p>` },

  'pattern.parallel.depth': { description: `
    <p>Depth range of the individual sub-passes, from–to in mm.</p>
    <p>Every sub-pass gets its own depth somewhere in this range. That is what creates the
    lively, uneven relief.</p>
    <p><b>Both values equal</b> gives every path exactly the same depth for a completely calm
    surface. Far apart gives strong depth contrast.</p>` },

  'pattern.parallel.length': { description: `
    <p>Length range of the sub-passes, from–to in mm.</p>
    <p>Each continuous line is broken into shorter sections whose length comes from this range.
    This produces the characteristic dashed, hand-worked look instead of continuous grooves.</p>
    <p class="hint">Short sections mean many plunges — that noticeably increases run time and
    puts load on the cutter tip.</p>` },

  'pattern.parallel.ramp': { description: `
    <p>How each sub-pass <b>enters and leaves the material</b>.</p>
    <p>Without a ramp the cutter drops straight down to full depth, cuts, and pulls straight out.
    That leaves a blunt, square-ended groove — and it is the hardest possible load on the tool,
    because a cutter has almost no cutting speed at the very centre of its face.</p>
    <p>A ramp eases the cut in and out instead, so the groove emerges from the surface and fades
    back into it:</p>
    <ul>
      <li><b>Linear</b> — a straight taper, even and predictable</li>
      <li><b>Linear – long</b> — the same, stretched to three times the length</li>
      <li><b>Radius</b> — a true circular arc that runs out tangentially into the floor, so the
          groove looks scooped out, as if cut with a gouge</li>
      <li><b>Exponential</b> — stays just under the surface a long way, then drops; gives a very
          long, fine tip</li>
    </ul>
    <p>The ramp length scales with the depth of each individual pass, so deeper cuts
    automatically get longer ramps and the look stays consistent.</p>
    <p class="hint">On sub-passes too short for a full ramp the groove simply becomes a shallow
    V with no flat bottom.</p>` },

  'pattern.parallel.gapChance': { description: `
    <p>Probability that a section is <b>skipped</b> — a value between 0 and 0.9.</p>
    <p><code>0</code> cuts everything. <code>0.15</code> leaves roughly every seventh section
    standing. High values create an airy, broken-up texture with plenty of original surface
    showing through.</p>` },

  'pattern.waves.stepover': { description: `
    <p>Distance between two rows of waves along Y.</p>
    <p>Smaller gives a denser wave field and finer relief, at the cost of run time.</p>` },

  'pattern.waves.sample': { description: `
    <p>Sampling distance along a row: a control point of the curve is placed every <i>n</i>&nbsp;mm.</p>
    <p>Small values give smoother waves but a lot of G-code lines. Large values make the curve
    visibly faceted, because it is built from few straight pieces.</p>
    <p class="hint">As a guideline pick roughly a tenth of the wavelength.</p>` },

  'pattern.waves.amp': { description: `
    <p>Amplitude: how far a row deviates from its base line along Y, in mm.</p>
    <p>The displacement comes from a noise field, so it is irregular rather than sinusoidal.
    Large values make neighbouring rows run into each other.</p>` },

  'pattern.waves.freq': { description: `
    <p>Frequency of the noise field that shapes the waves.</p>
    <p>Low gives long, calm sweeps across the whole board. High gives short, nervous waves.
    It works together with <i>Amplitude</i>: frequency sets the wavelength, amplitude the height.</p>` },

  'pattern.waves.depth': { description: `
    <p>Base depth of the wave paths in mm — the depth that <i>Depth ripple</i> varies around.</p>` },

  'pattern.waves.depthAmp': { description: `
    <p>How much the cutting depth additionally varies along the path, in mm.</p>
    <p>Driven by a second, independent noise field. This makes the surface restless <i>in depth</i>
    as well, which reads as more organic.</p>
    <p><code>0</code> makes every wave exactly the same depth.</p>` },

  'pattern.crosshatch.spacing': { description: `
    <p>Distance between two lines <b>within one direction</b>, in mm.</p>
    <p>Since two sets of lines are overlaid, this spacing is the visible diamond size — but the
    number of paths actually cut is twice as high.</p>` },

  'pattern.crosshatch.angle': { description: `
    <p>The two sets of lines run at <code>+angle</code> and <code>−angle</code>.</p>
    <ul>
      <li><code>45°</code> — the classic diamond pattern</li>
      <li><code>90°</code> — the sets meet at right angles, a square grid</li>
      <li>small angles — flat, elongated diamonds</li>
    </ul>` },

  'pattern.crosshatch.depth': { description: `
    <p>Depth range of the lines, from–to in mm.</p>
    <p>Every line gets its own depth somewhere in this range. A narrow range reads as clean and
    precise, a wide one as rustic.</p>
    <p class="hint">Intersections get cut twice — the groove there is always as deep as the
    deeper of the two lines.</p>` },

  'pattern.noisefield.stepover': { description: `
    <p>Distance between two sampling rows along Y.</p>
    <p>Together with <i>Sampling</i> this determines how finely the noise field is sampled.
    Smaller gives a more sculptural relief and a longer run time.</p>` },

  'pattern.noisefield.sample': { description: `
    <p>Sampling distance along a row in X, in mm.</p>
    <p>At every point the noise field is evaluated again and the depth derived from it. Small
    values give soft depth transitions, large ones visible steps.</p>` },

  'pattern.noisefield.scale': { description: `
    <p>Size of the structures in the noise field, in mm — essentially the "cloud size".</p>
    <p>Large (<code>100+</code>) gives a few broad hills and valleys spread across the board.
    Small (<code>10–20</code>) gives a fine-grained, restless texture.</p>` },

  'pattern.noisefield.maxDepth': { description: `
    <p>Depth at the points where the noise field reaches its maximum, in mm.</p>
    <p>In between, the depth fades smoothly down to zero at the <i>Threshold</i>.</p>` },

  'pattern.noisefield.threshold': { description: `
    <p>Cut-off value: wherever the noise field falls <b>below</b> it, the material is left standing.</p>
    <p>This creates <b>islands</b> of untouched original surface within the machined field.</p>
    <ul>
      <li>low / negative — almost everything gets cut, barely any islands</li>
      <li><code>0.15</code> — a balanced mix</li>
      <li>high — only isolated pockets, lots of standing surface</li>
    </ul>` },

  // ---------------- Cutter ----------------
  'pattern.blobs.density': { description: `
    <p>How densely the surface is filled with lakes, on a scale of <code>1</code> to <code>100</code>.</p>
    <ul>
      <li>low — a few scattered lakes with bare surface between them</li>
      <li>mid — lakes touch and occasionally overlap</li>
      <li><code>100</code> — lakes pile up and cover almost the whole surface</li>
    </ul>
    <p>The count adapts to the <i>Radius</i> range: larger lakes need fewer of them to reach the
    same coverage.</p>` },

  'pattern.blobs.size': { description: `
    <p>Radius of a lake, as a <b>from–to range</b>. Each lake gets a random radius within it.</p>
    <p>A wide range mixes small ponds and broad basins; a narrow range makes them all similar.</p>` },

  'pattern.blobs.depth': { description: `
    <p>Depth at the deepest point (the centre) of a lake, as a <b>from–to range</b> in mm.</p>
    <p>Every lake fades smoothly from this depth in the middle up to zero at its shore, so the
    basin has a soft, dished bottom rather than a flat floor.</p>` },

  'pattern.blobs.noise': { description: `
    <p>How irregular the shoreline of a lake is.</p>
    <ul>
      <li><code>0</code> — a perfect circle</li>
      <li>small — a gently squashed, few-lobed shape</li>
      <li>large — a wavy shoreline with bays and headlands</li>
    </ul>
    <p>The irregularity <b>fades toward the centre</b>, so each lake stays a smooth bowl with a
    wavy shore rather than growing radial ridges. The lobe count is random for each lake.</p>` },

  'pattern.blobs.stepover': { description: `
    <p>Spacing between the turns of the circular fill that clears each lake, in mm.</p>
    <p>Smaller gives a smoother basin but more cutting and a longer run time. As a rule of thumb,
    keep it at or below the cutter radius.</p>` },

  'pattern.blobs.finish': { description: `
    <p>Stepover of the finishing pass that re-traces each lake once more, in mm.</p>
    <p>A fine finish pass cleans up the ridges (scallops) a <b>ball nose</b> or <b>bullnose</b>
    cutter leaves between the roughing turns.</p>
    <p><b>0</b> switches the finishing pass off — faster, but the roughing scallops stay.</p>` },

  // ---------------- Pattern: Flowers ----------------
  'pattern.flowers.density': { description: `
    <p>How densely the surface is filled with flowers, on a scale of <code>1</code> to <code>100</code>.</p>
    <ul>
      <li>low — a few scattered flowers with bare surface between them</li>
      <li>mid — flowers touch and occasionally overlap</li>
      <li><code>100</code> — flowers pile up and cover almost the whole surface</li>
    </ul>
    <p>The count adapts to the <i>Radius</i> range: larger flowers need fewer of them to reach the
    same coverage.</p>` },

  'pattern.flowers.size': { description: `
    <p>Radius of a flower, as a <b>from–to range</b>. Each one gets a random radius within it.</p>
    <p>A wide range mixes small blossoms and broad rosettes; a narrow range makes them similar.</p>` },

  'pattern.flowers.depth': { description: `
    <p>Depth at the deepest point (the centre) of a flower, as a <b>from–to range</b> in mm.</p>
    <p>Each one fades smoothly from this depth in the middle up to zero at its rim.</p>` },

  'pattern.flowers.petals': { description: `
    <p>How pronounced the petals are.</p>
    <ul>
      <li><code>0</code> — a plain round dome, no petals</li>
      <li>mid — a clear flower / rosette</li>
      <li>high — deep, spiky petals</li>
    </ul>
    <p>The petals run from the rim all the way to the centre as radial ridges — that is what tells
    a flower apart from a smooth <i>Blob</i>. Petal count and shape are random for each flower.</p>` },

  'pattern.flowers.stepover': { description: `
    <p>Spacing between the turns of the circular fill that clears each flower, in mm.</p>
    <p>Smaller gives smoother petals but more cutting and a longer run time. As a rule of thumb,
    keep it at or below the cutter radius.</p>` },

  'pattern.flowers.finish': { description: `
    <p>Stepover of the finishing pass that re-traces each flower once more, in mm.</p>
    <p>A fine finish pass cleans up the ridges (scallops) a <b>ball nose</b> or <b>bullnose</b>
    cutter leaves between the roughing turns.</p>
    <p><b>0</b> switches the finishing pass off — faster, but the roughing scallops stay.</p>` },

  // ---------------- Cutter ----------------
  'sel.tool': { description: `
    <p>The cutter you are going to run.</p>
    <p>Its shape decides what the groove looks like in cross-section — round with a ball nose,
    flat-bottomed with straight walls from an end mill, a sharp V from a V-bit. The preview
    shows the real result, so you can judge the look before cutting anything.</p>
    <p class="hint">Pick the cutter you actually have in the spindle, then set its diameter to
    match. Everything else — depths, ridges, run time — follows from that.</p>` },

  'tool.ball.diameter': { description: `
    <p>Diameter of the ball nose cutter, in mm.</p>
    <p>The profile is a hemisphere of radius <code>d/2</code> — the groove gets a round bottom
    and soft transitions. The classic choice for organic textures.</p>
    <p>A ridge is left standing between adjacent passes, and its height <i>grows</i> as the
    diameter shrinks. The remedy is to reduce the stepover.</p>` },

  'tool.flat.diameter': { description: `
    <p>Diameter of the end mill, in mm.</p>
    <p>Produces a <b>flat groove bottom with vertical walls</b> — crisp edges, a technical look.
    Unlike a ball nose it leaves no ridge between passes, as long as the stepover is smaller
    than the diameter.</p>` },

  'tool.vee.diameter': { description: `
    <p>Largest diameter of the V-bit, in mm.</p>
    <p>Limits how wide the V groove can get. Cutting deeper than the cone is tall means the
    cutter continues with its cylindrical shank — the groove stops widening from there on.</p>` },

  'tool.vee.angle': { description: `
    <p>Included angle of the cone (the full angle, not the half angle), in degrees.</p>
    <ul>
      <li><code>90°</code> — standard for lettering and chamfers; the groove is twice as wide as deep</li>
      <li><code>60°</code> — slimmer, giving deeper and narrower cuts</li>
      <li><code>30°</code> — very fine, sharp lines; the tip is fragile</li>
      <li><code>120°+</code> — shallow, wide chamfers</li>
    </ul>
    <p class="hint">With V-bits the depth directly controls the width — unlike a ball nose or
    end mill.</p>` },

  'tool.torus.diameter': { description: `
    <p>Outer diameter of the torus / bullnose cutter, in mm.</p>` },

  'tool.torus.corner': { description: `
    <p>Corner radius in mm — the rounding between the flat bottom and the outer wall.</p>
    <p>The torus cutter sits between an end mill and a ball nose:</p>
    <ul>
      <li>small radius — almost an end mill, just with the edge broken</li>
      <li>radius = half the diameter — identical to a ball nose</li>
    </ul>
    <p>In practice the most durable compromise: a flat bottom like an end mill, but with the
    fracture-prone sharp corner rounded off.</p>` },

  // ---------------- CAM / paths ----------------
  'cam.maxDOC': { description: `
    <p>Maximum depth of cut per pass, in mm.</p>
    <p>If a path goes deeper, PatternMaster automatically splits it into stacked levels — each
    one this much deeper, alternating direction, with no retract in between.</p>
    <p><b>Guideline for hardwood:</b> roughly 0.5–1× the cutter diameter at full slot width,
    considerably less with small cutters and less rigid machines.</p>
    <p class="warn">Must be greater than 0. There is deliberately no "all in one go" mode —
    it would be the single most common cause of broken cutters.</p>` },

  'cam.safeZ': { description: `
    <p>Retract height above the workpiece surface, in mm.</p>
    <p>The machine pulls up to this height before travelling to the next position at rapid speed.
    Since <code>Z0</code> is the surface, the value is the clearance above it directly.</p>
    <p class="warn">It has to <b>clear every clamp</b> — hold-downs, screw heads, fences. This is
    the most common avoidable crash.</p>
    <p class="hint">On the other hand every millimetre costs time: across several thousand
    segments, going up and down adds up noticeably.</p>` },

  'cam.feed': { description: `
    <p>Feed rate for the <b>cutting moves in XY</b>, in mm/min.</p>
    <p>Properly derived from the chip load:</p>
    <p><code>feed = rpm × flutes × chip load</code></p>
    <p>For example: 18,000&nbsp;rpm × 2 flutes × 0.03&nbsp;mm ≈ 1,080&nbsp;mm/min.</p>
    <p class="hint">Slower is not the safe choice: below a certain feed the cutter stops cutting
    and starts rubbing — it heats up, the wood scorches and the edge goes dull.</p>` },

  'cam.plungeFeed': { description: `
    <p>Feed rate for <b>plunging straight down in Z</b>, in mm/min.</p>
    <p>At the centre of its face a cutter has virtually no cutting speed — it drops to zero at
    the axis of rotation. Plunging vertically is therefore the worst case: the material is
    crushed rather than cut.</p>
    <p><b>Rule of thumb:</b> ⅓ to ½ of the feed rate.</p>
    <p class="hint">Patterns with many short sub-passes plunge very often — this value then
    affects total run time more than the cutting feed does.</p>` },

  'cam.rapidRate': { description: `
    <p>The machine's rapid traverse speed in mm/min — the speed of <code>G0</code> moves that
    are not in contact with the material.</p>
    <p class="hint">This value is <b>not</b> written into the G-code — the controller knows its
    own rapid speed. It is used purely for the run time estimate, so enter what your machine
    actually does.</p>` },

  'cam.spindle': { description: `
    <p>Spindle speed in revolutions per minute, emitted as the <code>S</code> word.</p>
    <p>For wood and small cutters usually somewhere between 16,000 and 24,000&nbsp;rpm. Speed
    always belongs together with the feed rate — see the chip load formula there.</p>
    <p><code>0</code> emits no spindle commands at all (for machines switched on by hand).</p>` },

  // ---------------- Export ----------------
  'sel.post': { description: `
    <p>Which <b>G-code dialect</b> the exported file is written in.</p>
    <p>Pick the one your controller speaks:</p>
    <ul>
      <li><b>GRBL</b> — the usual choice for hobby CNC routers</li>
      <li><b>Marlin</b> — for machines running 3D-printer firmware</li>
    </ul>
    <p class="hint">Feed, plunge and spindle speed come from the <i>CAM / Toolpaths</i> section —
    they are the same whichever dialect you export.</p>` }
};

// Look-up with a fallback to '*.<param>' when no exact key exists.
PM.helpFor = function (key) {
  if (!key) return null;
  if (PM.help[key]) return PM.help[key];
  const short = key.split('.').pop();
  return PM.help['*.' + short] || null;
};
