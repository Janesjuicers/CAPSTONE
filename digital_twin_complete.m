% ============================================================
%  RMIT DIGITAL TWIN — TRUSS BRIDGE MONITOR
%  Capstone B 2026  |  OENG1168
%  Supervisor: Professor Ricky Chan
%
%  HOW TO USE:
%  1. Paste this entire file into a new MATLAB script (.m file)
%  2. Save it as: digital_twin_complete.m
%  3. Press Run (or type digital_twin_complete in Command Window)
%  4. Dashboard opens automatically
%  5. Close the figure window to stop
% ============================================================

digital_twin_dashboard();

% ============================================================
%  MAIN DASHBOARD FUNCTION
% ============================================================

function digital_twin_dashboard()

clc;
fprintf('==========================================================\n');
fprintf('  RMIT Digital Twin -- Truss Bridge Monitor  v1.0\n');
fprintf('  Capstone B 2026  |  Supervisor: Prof. Ricky Chan\n');
fprintf('==========================================================\n\n');

% Load truss geometry
truss = truss_geometry();

% Configuration
SAMPLE_RATE = 200;   % Hz
UPDATE_HZ   = 10;    % Dashboard refresh rate
WINDOW_SEC  = 10;    % Scrolling plot window (seconds)
E = truss.E;
A = truss.A;

% Initial FE solve at 1000 N mid-span to find worst member
fprintf('Running initial FE analysis to identify worst member...\n');
r0 = find_worst_member(truss, 1000, 4, 1.0);
GAUGE_MEMBER_IDX = r0.worst_idx;
fprintf('Strain gauge target member: %s (index %d)\n\n', ...
        truss.labels{GAUGE_MEMBER_IDX}, GAUGE_MEMBER_IDX);

% Initialise DAQ (switches to simulation if no hardware found)
daq_h = daq_setup('Dev1/ai0', SAMPLE_RATE, 2.0, 5.0);

% ── Colour palette ────────────────────────────────────────────────────────
BG       = [0.12 0.12 0.15];
PANEL    = [0.18 0.18 0.22];
COL_T    = [0.20 0.55 1.00];   % Blue  = tension
COL_C    = [1.00 0.30 0.20];   % Red   = compression
COL_W    = [1.00 0.85 0.00];   % Yellow = worst member
COL_N    = [0.55 0.55 0.60];   % Grey  = near zero
TXT      = [0.95 0.95 0.95];   % White text

% ── Build figure ──────────────────────────────────────────────────────────
fig = figure('Name', 'RMIT Digital Twin -- Truss Bridge', ...
             'NumberTitle', 'off', ...
             'Color', BG, ...
             'Position', [50 50 1400 820], ...
             'CloseRequestFcn', @on_close, ...
             'Resize', 'on');

% Axes layout
ax_truss  = axes(fig, 'Position', [0.03  0.38  0.60  0.57]);
ax_strain = axes(fig, 'Position', [0.67  0.55  0.31  0.40]);
ax_bar    = axes(fig, 'Position', [0.03  0.05  0.60  0.30]);
ax_gauge  = axes(fig, 'Position', [0.67  0.05  0.31  0.40]);

for ax = [ax_truss, ax_strain, ax_bar, ax_gauge]
    set(ax, 'Color', PANEL, 'XColor', TXT, 'YColor', TXT, ...
            'GridColor', [0.4 0.4 0.45], 'GridAlpha', 0.4);
    grid(ax, 'on');
end

% Status text boxes
uiStatus = uicontrol(fig, 'Style', 'text', ...
    'Units', 'normalized', 'Position', [0.67 0.47 0.31 0.07], ...
    'BackgroundColor', PANEL, 'ForegroundColor', TXT, ...
    'FontSize', 11, 'FontName', 'Consolas', 'HorizontalAlignment', 'left', ...
    'String', 'Initialising...');

uiWorst = uicontrol(fig, 'Style', 'text', ...
    'Units', 'normalized', 'Position', [0.67 0.40 0.31 0.06], ...
    'BackgroundColor', [0.25 0.20 0.05], 'ForegroundColor', COL_W, ...
    'FontSize', 12, 'FontName', 'Consolas', 'FontWeight', 'bold', ...
    'HorizontalAlignment', 'left', 'String', 'Worst member: --');

% Title banner
annotation(fig, 'textbox', [0.0 0.960 1.0 0.04], ...
    'String', 'RMIT Real-Time Digital Twin  |  Pratt Truss Bridge  |  Capstone B 2026', ...
    'Color', TXT, 'FontSize', 13, 'FontWeight', 'bold', ...
    'EdgeColor', 'none', 'BackgroundColor', BG, 'HorizontalAlignment', 'center');

% Strain history buffer
hist_len    = WINDOW_SEC * SAMPLE_RATE;
strain_hist = zeros(hist_len, 1);
time_hist   = linspace(-WINDOW_SEC, 0, hist_len)';
cycle_count = 0;
cal_factor  = 1.0;

% Initial draw
results = r0;
draw_truss(ax_truss,  truss, results, COL_T, COL_C, COL_W, COL_N, TXT);
draw_bar_chart(ax_bar, truss, results, COL_T, COL_C, COL_W, TXT);
draw_strain_trace(ax_strain, time_hist, strain_hist, TXT);
draw_gauge(ax_gauge, 0, results.util(GAUGE_MEMBER_IDX), TXT, COL_W, ...
           truss.labels{GAUGE_MEMBER_IDX});

% ── Main real-time loop ───────────────────────────────────────────────────
running = true;
fprintf('Dashboard running. Close the figure window to stop.\n\n');

while running && ishandle(fig)

    % Read one strain sample from DAQ or simulation
    [strain_raw, ~, daq_h] = daq_read_strain(daq_h);
    strain_filtered = apply_lowpass(daq_h, 10);

    % Shift rolling buffer
    strain_hist = circshift(strain_hist, -1);
    strain_hist(end) = strain_filtered;
    cycle_count = cycle_count + 1;

    % Update FE model at dashboard refresh rate
    if mod(cycle_count, round(SAMPLE_RATE / UPDATE_HZ)) == 0
        t_start = tic;

        % Estimate applied load from gauge strain
        measured_force = E * A * strain_filtered;
        theoretical_force_per_N = abs(r0.N(GAUGE_MEMBER_IDX)) / 1000;
        if theoretical_force_per_N > 1e-6
            estimated_load = abs(measured_force) / theoretical_force_per_N;
        else
            estimated_load = 0;
        end
        estimated_load = max(0, min(estimated_load, 5000));

        % RLS calibration factor update
        if abs(r0.N(GAUGE_MEMBER_IDX)) > 1e-6
            cal_factor = 0.9 * cal_factor + ...
                0.1 * (measured_force / r0.N(GAUGE_MEMBER_IDX));
            cal_factor = max(0.5, min(cal_factor, 2.0));
        end

        % Re-run FE with updated load and calibration
        results = find_worst_member(truss, max(estimated_load, 1), 4, cal_factor);
        latency_ms = toc(t_start) * 1000;

        % Redraw all panels
        draw_truss(ax_truss, truss, results, COL_T, COL_C, COL_W, COL_N, TXT);
        draw_bar_chart(ax_bar, truss, results, COL_T, COL_C, COL_W, TXT);
        draw_strain_trace(ax_strain, time_hist, strain_hist, TXT);
        draw_gauge(ax_gauge, strain_filtered, ...
                   results.util(GAUGE_MEMBER_IDX), TXT, COL_W, ...
                   truss.labels{GAUGE_MEMBER_IDX});

        % Update status labels
        if daq_h.sim_mode
            mode_str = 'SIM';
        else
            mode_str = 'LIVE';
        end

        set(uiStatus, 'String', sprintf( ...
            '[%s]  Load est: %.0f N    Disp: %.2f mm    Latency: %.0f ms', ...
            mode_str, estimated_load, results.mid_disp * 1000, latency_ms));

        util_pct = results.util(results.worst_idx) * 100;
        set(uiWorst, 'String', sprintf('  Worst: %s   Utilisation: %.1f%%', ...
            results.worst_label, util_pct));

        if util_pct > 80
            set(uiWorst, 'BackgroundColor', [0.5 0.1 0.1]);
        elseif util_pct > 50
            set(uiWorst, 'BackgroundColor', [0.35 0.25 0.0]);
        else
            set(uiWorst, 'BackgroundColor', [0.10 0.25 0.10]);
        end

        drawnow limitrate;
    end

    pause(1 / SAMPLE_RATE);
end

fprintf('\nDashboard closed.\n');

    function on_close(~, ~)
        running = false;
        delete(fig);
    end

end % end digital_twin_dashboard


% ============================================================
%  TRUSS GEOMETRY
% ============================================================

function truss = truss_geometry()
% Define the RMIT ~2m Pratt truss geometry and material properties.

span    = 2.0;    % Total span [m]
height  = 0.4;    % Truss depth [m]
nPanels = 5;      % Number of panels
panelL  = span / nPanels;

% Node coordinates
% Bottom chord: nodes 1-6 (y=0)
% Top interior:  nodes 7-10 (y=height)
bottomX = (0:nPanels)' * panelL;
bottomY = zeros(nPanels+1, 1);
topX    = (1:nPanels-1)' * panelL;
topY    = height * ones(nPanels-1, 1);

nodes   = [bottomX, bottomY; topX, topY];
nNodes  = size(nodes, 1);

% Element connectivity [node_i, node_j]
elements = [
    % Bottom chord (5)
    1,2; 2,3; 3,4; 4,5; 5,6;
    % Top chord (3)
    7,8; 8,9; 9,10;
    % Verticals (4)
    2,7; 3,8; 4,9; 5,10;
    % Diagonals (5) - Pratt: tension diagonals under gravity
    1,7; 7,3; 8,4; 9,5; 10,6
];
nElems = size(elements, 1);

% Material: Aluminium 6061-T6
E  = 69e9;     % Young's modulus [Pa]
A  = 2.0e-4;   % Cross-sectional area [m^2]
fy = 270e6;    % Yield strength [Pa]

% Boundary conditions
% Node 1: pin  -> fix DOF 1 (ux) and DOF 2 (uy)
% Node 6: roller -> fix DOF 12 (uy)
bc_fixed = [1, 2, 12];

% Member labels
labels = {'BC1','BC2','BC3','BC4','BC5', ...
          'TC1','TC2','TC3', ...
          'V1','V2','V3','V4', ...
          'D1','D2','D3','D4','D5'};

% Pack struct
truss.nodes    = nodes;
truss.elements = elements;
truss.nNodes   = nNodes;
truss.nElems   = nElems;
truss.E        = E;
truss.A        = A;
truss.fy       = fy;
truss.bc_fixed = bc_fixed;
truss.labels   = labels;
truss.span     = span;
truss.height   = height;

fprintf('Truss loaded: %d nodes, %d members\n', nNodes, nElems);
end


% ============================================================
%  FE SOLVER — FIND WORST MEMBER
% ============================================================

function results = find_worst_member(truss, load_N, load_node, cal_factor)
% 2-D direct stiffness FE solver. Returns all member forces and worst member.

if nargin < 3 || isempty(load_node), load_node = 4;   end
if nargin < 4 || isempty(cal_factor), cal_factor = 1.0; end

nodes    = truss.nodes;
elements = truss.elements;
E        = truss.E;
A        = truss.A;
fy       = truss.fy;
bc_fixed = truss.bc_fixed;
nNodes   = truss.nNodes;
nElems   = truss.nElems;
ndof     = 2 * nNodes;

% Assemble global stiffness matrix
K = zeros(ndof, ndof);
for e = 1:nElems
    ni = elements(e,1);  nj = elements(e,2);
    xi = nodes(ni,1);    yi = nodes(ni,2);
    xj = nodes(nj,1);    yj = nodes(nj,2);
    L  = sqrt((xj-xi)^2 + (yj-yi)^2);
    c  = (xj-xi)/L;      s  = (yj-yi)/L;
    ke = (E*A/L)*[ c^2,  c*s, -c^2, -c*s;
                   c*s,  s^2, -c*s, -s^2;
                  -c^2, -c*s,  c^2,  c*s;
                  -c*s, -s^2,  c*s,  s^2];
    dof = [2*ni-1, 2*ni, 2*nj-1, 2*nj];
    K(dof,dof) = K(dof,dof) + ke;
end

% Load vector (downward at load_node)
F = zeros(ndof,1);
F(2*load_node) = -load_N;

% Solve partitioned system
free = setdiff(1:ndof, bc_fixed);
U    = zeros(ndof,1);
try
    U(free) = K(free,free) \ F(free);
    converged = true;
catch
    converged = false;
end

% Recover member forces
N      = zeros(nElems,1);
stress = zeros(nElems,1);
strain = zeros(nElems,1);

for e = 1:nElems
    ni = elements(e,1);  nj = elements(e,2);
    xi = nodes(ni,1);    yi = nodes(ni,2);
    xj = nodes(nj,1);    yj = nodes(nj,2);
    L  = sqrt((xj-xi)^2 + (yj-yi)^2);
    c  = (xj-xi)/L;      s  = (yj-yi)/L;
    u_e   = U([2*ni-1, 2*ni, 2*nj-1, 2*nj]);
    dL    = [-c, -s, c, s] * u_e;
    N(e)      = cal_factor * (E*A/L) * dL;
    stress(e) = N(e) / A;
    strain(e) = dL / L;
end

util = abs(stress) / fy;
[~, worst_idx] = max(util);

results.U           = U;
results.N           = N;
results.stress      = stress;
results.strain      = strain;
results.util        = util;
results.worst_idx   = worst_idx;
results.worst_label = truss.labels{worst_idx};
results.mid_disp    = U(2*load_node);
results.converged   = converged;
results.load_N      = load_N;
results.cal_factor  = cal_factor;
end


% ============================================================
%  DAQ SETUP & READING
% ============================================================

function daq_h = daq_setup(channel_id, sample_rate, gauge_factor, excitation_V)
% Initialise NI-DAQ or fall back to simulation mode.

if nargin < 1, channel_id   = 'Dev1/ai0'; end
if nargin < 2, sample_rate  = 200;        end
if nargin < 3, gauge_factor = 2.0;        end
if nargin < 4, excitation_V = 5.0;        end

BUFFER_SIZE = sample_rate * 10;

daq_h.GF          = gauge_factor;
daq_h.Vex         = excitation_V;
daq_h.sample_rate = sample_rate;
daq_h.buffer      = zeros(BUFFER_SIZE,1);
daq_h.timestamps  = zeros(BUFFER_SIZE,1);
daq_h.buf_idx     = 1;
daq_h.channel_id  = channel_id;

hardware_found = false;
try
    if license('test','Data_Acquisition_Toolbox')
        dq = daq('ni');
        parts = strsplit(channel_id,'/');
        addinput(dq, parts{1}, parts{2}, 'Voltage');
        dq.Rate = sample_rate;
        daq_h.dq = dq;
        hardware_found = true;
        fprintf('[DAQ] NI hardware connected: %s at %d Hz\n', channel_id, sample_rate);
    end
catch ME
    fprintf('[DAQ] Hardware not found: %s\n', ME.message);
end

if ~hardware_found
    daq_h.dq       = [];
    daq_h.sim_mode = true;
    daq_h.sim_t    = 0;
    fprintf('[DAQ] SIMULATION MODE active -- synthetic strain signal running.\n');
else
    daq_h.sim_mode = false;
end
end


function [strain_val, voltage_raw, daq_h] = daq_read_strain(daq_h)
% Read one strain sample from hardware or simulation.

GF  = daq_h.GF;
Vex = daq_h.Vex;

if daq_h.sim_mode
    t            = daq_h.sim_t;
    base         = 2.5e-5;
    vib          = 0.3e-5 * sin(2*pi*5*t);
    noise        = 0.05e-5 * randn();
    drift        = 0.5e-5 * sin(2*pi*0.1*t);
    strain_val   = base + vib + noise + drift;
    voltage_raw  = (strain_val * GF * Vex) / (4 - 2*strain_val*GF);
    daq_h.sim_t  = t + 1/daq_h.sample_rate;
else
    try
        data        = read(daq_h.dq, 1);
        voltage_raw = data.Variables(1);
        Vr          = voltage_raw / Vex;
        strain_val  = (4*Vr) / (GF*(1 + 2*Vr));
    catch
        voltage_raw = 0;
        strain_val  = 0;
    end
end

% Update rolling buffer
idx = mod(daq_h.buf_idx-1, length(daq_h.buffer)) + 1;
daq_h.buffer(idx)     = strain_val;
daq_h.timestamps(idx) = now;
daq_h.buf_idx         = daq_h.buf_idx + 1;
end


function strain_out = apply_lowpass(daq_h, window_size)
% Moving-average low-pass filter over rolling buffer.
if nargin < 2, window_size = 10; end
buf = daq_h.buffer;
n   = min(window_size, daq_h.buf_idx - 1);
if n < 1, strain_out = 0; return; end
idx_end   = mod(daq_h.buf_idx-2, length(buf)) + 1;
idx_start = mod(daq_h.buf_idx-n-1, length(buf)) + 1;
if idx_end >= idx_start
    recent = buf(idx_start:idx_end);
else
    recent = [buf(idx_start:end); buf(1:idx_end)];
end
strain_out = mean(recent);
end


% ============================================================
%  DRAWING FUNCTIONS
% ============================================================

function draw_truss(ax, truss, results, COL_T, COL_C, COL_W, COL_N, TXT)
% Colour-coded truss diagram. Blue=tension, Red=compression, Yellow=worst.
cla(ax); hold(ax,'on');

N     = results.N;
maxN  = max(abs(N));
if maxN < 1e-6, maxN = 1; end

nodes    = truss.nodes;
elements = truss.elements;

for e = 1:truss.nElems
    ni = elements(e,1); nj = elements(e,2);
    x  = [nodes(ni,1), nodes(nj,1)];
    y  = [nodes(ni,2), nodes(nj,2)];
    r  = N(e)/maxN;

    if e == results.worst_idx
        col = COL_W; lw = 5;
    elseif r > 0.01
        col = COL_T*abs(r) + COL_N*(1-abs(r)); lw = 2+2*abs(r);
    elseif r < -0.01
        col = COL_C*abs(r) + COL_N*(1-abs(r)); lw = 2+2*abs(r);
    else
        col = COL_N; lw = 1.5;
    end

    plot(ax, x, y, '-', 'Color', col, 'LineWidth', lw);

    mx = mean(x); my = mean(y);
    text(ax, mx, my+0.025, sprintf('%s\n%.2f kN', truss.labels{e}, N(e)/1000), ...
        'Color', TXT, 'FontSize', 6.5, 'HorizontalAlignment', 'center');
end

plot(ax, nodes(:,1), nodes(:,2), 'o', 'MarkerSize',7, ...
    'MarkerFaceColor',[0.9 0.9 0.9], 'MarkerEdgeColor','k', 'LineWidth',1);

for n = 1:truss.nNodes
    text(ax, nodes(n,1), nodes(n,2)-0.045, sprintf('N%d',n), ...
        'Color', TXT, 'FontSize', 7, 'HorizontalAlignment','center');
end

% Support symbols
plot(ax, nodes(1,1), nodes(1,2), 'v', 'MarkerSize',12, ...
    'MarkerFaceColor',[0.7 0.7 0.3], 'MarkerEdgeColor', TXT);
plot(ax, nodes(6,1), nodes(6,2), 'v', 'MarkerSize',12, ...
    'MarkerFaceColor',[0.5 0.5 0.5], 'MarkerEdgeColor', TXT);

patch(ax,NaN,NaN,COL_T,'EdgeColor',COL_T,'DisplayName','Tension');
patch(ax,NaN,NaN,COL_C,'EdgeColor',COL_C,'DisplayName','Compression');
patch(ax,NaN,NaN,COL_W,'EdgeColor',COL_W,'DisplayName','WORST member');
legend(ax,'show','Location','south','Orientation','horizontal', ...
    'TextColor',TXT,'Color',[0.18 0.18 0.22],'EdgeColor','none','FontSize',8);

set(ax,'XLim',[-0.1 2.1],'YLim',[-0.15 0.65]);
xlabel(ax,'x (m)','Color',TXT);
ylabel(ax,'y (m)','Color',TXT);
title(ax, sprintf('Member Forces  |  Est. Load: %.0f N', results.load_N), ...
    'Color', TXT, 'FontSize', 10);
axis(ax,'equal');
hold(ax,'off');
end


function draw_bar_chart(ax, truss, results, COL_T, COL_C, COL_W, TXT)
% Horizontal bar chart of all member forces.
cla(ax);
N = results.N;
n = truss.nElems;
colors = zeros(n,3);
for e = 1:n
    if e == results.worst_idx
        colors(e,:) = COL_W;
    elseif N(e) >= 0
        colors(e,:) = COL_T;
    else
        colors(e,:) = COL_C;
    end
end
barh(ax, 1:n, N/1000, 'FaceColor','flat','CData',colors,'EdgeColor','none','BarWidth',0.7);
set(ax,'YTick',1:n,'YTickLabel',truss.labels,'FontSize',7.5,'TickLabelInterpreter','none');
xlabel(ax,'Axial Force (kN)  [ +ve = tension ]','Color',TXT,'FontSize',9);
title(ax,'Member Forces — All Members','Color',TXT,'FontSize',9);
xline(ax, 0,'--','Color',[0.8 0.8 0.8],'LineWidth',1);
end


function draw_strain_trace(ax, t_vec, strain_hist, TXT)
% Scrolling real-time strain trace.
cla(ax);
plot(ax, t_vec, strain_hist*1e6, '-', 'Color',[0.20 0.85 0.50],'LineWidth',1.2);
xlabel(ax,'Time (s)','Color',TXT,'FontSize',9);
ylabel(ax,'Strain (\mu\epsilon)','Color',TXT,'FontSize',9);
title(ax,'Real-Time Strain Gauge (Worst Member)','Color',TXT,'FontSize',9);
xlim(ax,[t_vec(1), t_vec(end)]);
yl = max(abs(strain_hist))*1e6;
if yl < 1, yl = 50; end
ylim(ax,[-yl*1.3, yl*1.3]);
end


function draw_gauge(ax, strain_val, util_ratio, TXT, COL_W, member_label)
% Semicircular utilisation gauge with needle.
cla(ax); hold(ax,'on');

theta = linspace(pi, 0, 180);
r_out = 1.0; r_in = 0.6;
fill(ax, [r_out*cos(theta), r_in*cos(fliplr(theta))], ...
        [r_out*sin(theta), r_in*sin(fliplr(theta))], ...
        [0.30 0.30 0.35], 'EdgeColor','none');

util_c = min(max(util_ratio,0),1.0);
t_fill = linspace(pi, pi - util_c*pi, max(2,round(util_c*180)));
if length(t_fill) > 1
    if util_ratio > 0.80,     fc = [1.0, 0.2, 0.1];
    elseif util_ratio > 0.50, fc = [1.0, 0.65, 0.0];
    else,                     fc = [0.15, 0.75, 0.35];
    end
    fill(ax, [r_out*cos(t_fill), r_in*cos(fliplr(t_fill))], ...
            [r_out*sin(t_fill), r_in*sin(fliplr(t_fill))], ...
            fc, 'EdgeColor','none');
end

for pct = 0:25:100
    ang = pi - (pct/100)*pi;
    plot(ax,[0.57*cos(ang),0.63*cos(ang)],[0.57*sin(ang),0.63*sin(ang)], ...
        '-','Color',TXT,'LineWidth',1.5);
    text(ax,1.15*cos(ang),1.15*sin(ang),sprintf('%d%%',pct), ...
        'Color',TXT,'FontSize',7,'HorizontalAlignment','center');
end

ang_needle = pi - util_c*pi;
plot(ax,[0, 0.75*cos(ang_needle)],[0, 0.75*sin(ang_needle)], ...
    '-','Color',COL_W,'LineWidth',2.5);
plot(ax,0,0,'o','MarkerSize',8,'MarkerFaceColor',TXT,'MarkerEdgeColor','none');

text(ax,0,-0.15, sprintf('%.1f%%', util_ratio*100), ...
    'Color',TXT,'FontSize',14,'FontWeight','bold','HorizontalAlignment','center');
text(ax,0,-0.32, sprintf('\\epsilon = %.1f \\mu\\epsilon', strain_val*1e6), ...
    'Color',TXT,'FontSize',9,'HorizontalAlignment','center');
text(ax,0,-0.48,'UTILISATION','Color',TXT,'FontSize',8,'HorizontalAlignment','center');

axis(ax,'equal'); xlim(ax,[-1.3 1.3]); ylim(ax,[-0.6 1.1]); axis(ax,'off');
title(ax, sprintf('Gauge Member: %s', member_label),'Color',TXT,'FontSize',9);
hold(ax,'off');
end