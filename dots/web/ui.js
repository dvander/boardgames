// vim: set sts=2 ts=8 sw=2 tw=99 et:

function UI(canvas, dot_rows, dot_cols)
{
  this.canvas = canvas;
  this.dot_rows = dot_rows;
  this.dot_cols = dot_cols;
  this.rows = dot_rows * 2 - 1;
  this.cols = dot_cols * 2 - 1;
  this.dot_spacing = 50;
  this.dot_radius = 3;
  this.close_factor = 4;
  this.line_width = 2;

  this.canvas.height = (this.dot_rows + 1) * this.dot_spacing;
  this.canvas.width = (this.dot_cols + 1) * this.dot_spacing;
  this.highlight = null;
  this.board = Board.New(dot_rows, dot_cols);
  this.history = [];

  this.scorebox_a = document.getElementById('scoreboxA');
  this.scorebox_b = document.getElementById('scoreboxB');
}

UI.Point = function (x, y)
{
  this.x = x;
  this.y = y;
}

UI.Edge = function (p1, p2)
{
  this.p1 = p1;
  this.p2 = p2;
}

UI.prototype.getMouseCoords = function (e)
{
  var x, y;
  if (e.pageX != undefined && e.pageY != undefined) {
    x = e.pageX;
    y = e.pageY;
  } else {
    x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
    y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
  }

  x -= this.canvas.offsetLeft;
  y -= this.canvas.offsetTop;
  return new UI.Point(x, y);
}

UI.prototype.findNearestEdge = function (x, y)
{
  // Dots start at dot_spacing and are placed every dot_spacing pixels. Find
  // how far between the dot rows/columns we are.
  var x_mod = x % this.dot_spacing;
  var y_mod = y % this.dot_spacing;

  var low_region = this.dot_spacing / this.close_factor;
  var high_region = this.dot_spacing - low_region;

  var close_x = null,
      close_y = null;
  if (x_mod <= low_region)
    close_x = ((x / this.dot_spacing) | 0) - 1;
  else if (x_mod >= high_region)
    close_x = ((x / this.dot_spacing) | 0);
  if (y_mod <= low_region)
    close_y = ((y / this.dot_spacing) | 0) - 1;
  else if (y_mod >= high_region)
    close_y = ((y / this.dot_spacing) | 0);

  // Clip any nearby edge we found to actual bounds.
  if (close_x < 0 || close_x >= this.dot_cols)
    close_x = null;
  if (close_y < 0 || close_y >= this.dot_rows)
    close_y = null;

  // Found no point.
  if (close_x === null && close_y === null)
    return null;

  // If the cursor is in a corner, pick the direction that had the shortest
  // distance. If they are too close, return null.
  if (close_x !== null && close_y !== null) {
    var x_factor = x_mod <= low_region ? x_mod : this.dot_spacing - x_mod;
    var y_factor = y_mod <= low_region ? y_mod : this.dot_spacing - y_mod;
    if (Math.abs(x_factor - y_factor) <= this.dot_radius)
      return null;

    if (x_factor < y_factor)
      close_y = null;
    else 
      close_x = null;
  }

  // Build the line information. We already checked the bounds of either the
  // row or the column, but not the corresponding column or row, so we do that
  // here as well.
  var p1, p2;
  if (close_x !== null) {
    // Vertical line.
    var grid_col = close_x;
    var grid_row = ((y / this.dot_spacing) | 0) - 1;
    if (grid_row < 0 || grid_row + 1 >= this.dot_rows)
      return null;

    p1 = new UI.Point(grid_col, grid_row),
    p2 = new UI.Point(grid_col, grid_row + 1);
  } else {
    // Horizontal line.
    var grid_row = close_y;
    var grid_col = ((x / this.dot_spacing) | 0) - 1;
    if (grid_col < 0 || grid_col + 1 >= this.dot_cols)
      return null;

    p1 = new UI.Point(grid_col, grid_row),
    p2 = new UI.Point(grid_col + 1, grid_row);
  }

  return new UI.Edge(p1, p2);
}

UI.prototype.start = function ()
{
  this.canvas.addEventListener('click', this.onClick.bind(this));
  this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
  this.render();
}

UI.prototype.onMouseMove = function (e)
{
  if (this.board.current_player() != Board.Player_A)
    return;

  var point = this.getMouseCoords(e);
  var edge = this.findNearestEdge(point.x, point.y);
  if (edge) {
    var vertex = this.board.edgeToVertex(edge);
    if (!this.board.isValidMove(vertex))
      edge = null;
  }
  this.highlight = edge;
  this.render();
}

UI.prototype.onClick = function (e)
{
  if (this.board.current_player() != Board.Player_A)
    return;

  var point = this.getMouseCoords(e);
  var edge = this.findNearestEdge(point.x, point.y);
  if (!edge)
    return;

  var vertex = this.board.edgeToVertex(edge);
  if (vertex === null) {
    alert('Unexpected error: could not find a vertex for this click');
    return;
  }

  if (!this.board.isValidMove(vertex))
    return;

  this.board.playAt(vertex);
  this.history.push(vertex);

  if (this.highlight && this.board.edgeToVertex(this.highlight) == vertex)
    this.highlight = null;
  this.render();

  if (this.board.current_player() == Board.Player_A)
    return;

  function run_ai() {
    var uct = new UCT(this.board, 2000000, 10);
    var vertex = uct.run();
    this.board.playAt(vertex);
    this.history.push(vertex);
    this.render();
    if (!this.board.game_over() && this.board.current_player() == Board.Player_B)
      setTimeout(run_ai.bind(this), 10);
  }

  setTimeout(run_ai.bind(this), 10);
}

UI.prototype.dotPos = function (n)
{
  return this.dot_spacing + (n * this.dot_spacing) + 0.5;
}

UI.prototype.render = function ()
{
  var cx = this.canvas.getContext('2d');

  var cornerRadius = 20;
  var rect_x = 0, rect_y = 0;
  var rect_width = this.canvas.width;
  var rect_height = this.canvas.height;

  cx.globalCompositeOperation = 'source-over';

  cx.lineJoin = 'round';
  cx.lineWidth = cornerRadius;
  cx.strokeStyle = '#e0e0e0';
  cx.strokeRect(rect_x + (cornerRadius / 2), rect_y + (cornerRadius / 2),
                rect_width - cornerRadius, rect_height - cornerRadius);
  cx.fillStyle = '#f6f6f6';
  cx.fillRect(rect_x + (cornerRadius / 2), rect_y + (cornerRadius / 2),
              rect_width - cornerRadius, rect_height - cornerRadius);

  cx.fillStyle = '#000';
  for (var x = 0; x < this.dot_rows; x++) {
    for (var y = 0; y < this.dot_cols; y++) {
      var x_pos = this.dotPos(x);
      var y_pos = this.dotPos(y);
      cx.beginPath();
      cx.arc(x_pos, y_pos, 3, 0, 2 * Math.PI, true);
      cx.fill();
    } 
  }

  function player_color(player) {
    return (player == Board.Player_A)
           ? '#ff3300'
           : '#3366ff';
  }

  function drawLine(ui, edge, color) {
    var rm = 6;
    cx.beginPath();
    cx.strokeStyle = color;
    cx.lineWidth = ui.line_width;
    if (edge.p1.x < edge.p2.x) {
      cx.moveTo(ui.dotPos(edge.p1.x) + rm + 1, ui.dotPos(edge.p1.y));
      cx.lineTo(ui.dotPos(edge.p2.x) - rm, ui.dotPos(edge.p2.y));
    } else {
      cx.moveTo(ui.dotPos(edge.p1.x), ui.dotPos(edge.p1.y) + rm);
      cx.lineTo(ui.dotPos(edge.p2.x), ui.dotPos(edge.p2.y) - rm);
    }
    cx.stroke();
  }

  if (this.highlight)
    drawLine(this, this.highlight, player_color(this.board.current_player()));

  var edges = this.board.edges();
  for (var i = 0; i < edges.length; i++) {
    drawLine(this, edges[i].coords, player_color(edges[i].player));
  }

  function drawRect(ui, x, y, w, h, r, color) {
    cx.beginPath();
    cx.lineWidth = 2;
    cx.fillStyle = color;
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y);
    cx.quadraticCurveTo(x + w, y, x + w, y + r);
    cx.lineTo(x + w, y + h - r);
    cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    cx.lineTo(x + r, y + h);
    cx.quadraticCurveTo(x, y + h, x, y + h - r);
    cx.lineTo(x, y + r);
    cx.quadraticCurveTo(x, y, x + r, y);
    cx.closePath();
    cx.fill();
  }

  cx.globalCompositeOperation = 'darker';

  // Fill first so we can draw over it.
  var filled = this.board.filled();
  for (var i = 0; i < filled.length; i++) {
    var player = filled[i].player;
    var point = filled[i].point;
    var x = this.dotPos(point.x);
    var y = this.dotPos(point.y);
    var rm = 5;

    drawRect(
      this,
      x + rm,
      y + rm,
      this.dot_spacing - rm * 2 - 0.5,
      this.dot_spacing - rm * 2,
      5,
      player_color(player)
    );
  }

  var score_a = this.board.score(Board.Player_A);
  var score_b = this.board.score(Board.Player_B);
  this.scorebox_a.innerHTML = score_a;
  this.scorebox_b.innerHTML = score_b;

  //Debug log of move history.
  document.getElementById('hams').innerHTML = this.history.toString();
}

function StartGame()
{
  var canvas = document.getElementById('viewport')
  var ui = new UI(canvas, 8, 8);
  ui.start();
}

