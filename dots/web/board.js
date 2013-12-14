// vim: set sts=2 ts=8 sw=2 tw=99 et:
// Copyright (C) 2010-2013 David Anderson 
// dvander@alliedmods.net
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:
// 
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.
//

function Board(dot_rows, dot_cols)
{
  this.dot_rows_ = dot_rows;
  this.dot_cols_ = dot_cols;
  this.rows_ = dot_rows * 2 - 1;
  this.cols_ = dot_cols * 2 - 1;
  this.bottom_edge_ = (this.rows_ - 1) * this.cols_;
  this.grid_ = new Int32Array(this.rows_ * this.cols_ * 3 + 4);
  this.max_moves_ = (dot_cols - 1) * dot_rows + (dot_rows - 1) * dot_cols;

  // These are ranges into grid_
  this.empty_map_ = this.rows_ * this.cols_;
  this.empty_list_ = this.empty_map_ + this.rows_ * this.cols_;
  this.scores_ = this.empty_list_ + this.rows_ * this.cols_;

  this.empty_count_ = 0;
  this.capturable_ = (dot_rows - 1) * (dot_cols - 1);
  this.current_player_ = Board.Player_A;
}

Board.Player_A = 2;
Board.Player_B = 2 ^ 1;

Board.New = function (dot_rows, dot_cols)
{
  var board = new Board(dot_rows, dot_cols);

  // Visually, grids look like this:
  //  .-.-.-. 
  //  ! ! ! .
  //  . . . .
  //  . . . .
  //
  // We transform the grid to a checkerboard:
  // _______________
  // |_|X|_|X|_|X|_|
  // |X|_|X|_|X|_|X|
  // |_|_|_|_|_|_|_|
  // |_|_|_|_|_|_|_|
  // |_|_|_|_|_|_|_|
  // |_|_|_|_|_|_|_|
  // |_|_|_|_|_|_|_|
  //
  // Filled, with O marking capturable points:
  // _______________
  // |_|X|_|X|_|X|_|
  // |X|O|X|O|X|O|X|
  // |_|X|_|X|_|X|_|
  // |X|O|X|O|X|O|X|
  // |_|X|_|X|_|X|_|
  // |X|O|X|O|X|O|X|
  // |_|X|_|X|_|X|_|
  //
  // A grid with N dot-rows and M dot-cols becomes an (N-1) * (M-1)
  // checkerboard, and space is surrounded by diamond patterns instead of
  // lines. This makes bookkeeping a lot easier.

  // Build the empty vertex list, which is used for performing fast random
  // playouts. Note we start at index 1, since the corners are not playable.
  for (var i = 1; i < board.rows_ * board.cols_; i += 2) {
    board.grid_[board.empty_map_ + i] = board.empty_count_;
    board.grid_[board.empty_list_ + board.empty_count_] = i;
    board.empty_count_++;
  }

  return board;
}

Board.prototype.inherit = function (board)
{
  for (var i = 0; i < this.grid_.length; i++)
    this.grid_[i] = board.grid_[i];

  this.empty_count_ = board.empty_count_;
  this.capturable_ = board.capturable_;
  this.current_player_ = board.current_player_;
}

Board.prototype.clone = function ()
{
  var board = Board.New(this.dot_rows_, this.dot_cols_);
  board.inherit(this);
  return board;
}

Board.prototype.freeVertices = function ()
{
  return this.empty_count_;
}

Board.prototype.getFreeVertex = function (index)
{
  return this.grid_[this.empty_list_ + index];
}

// For the UI.
Board.prototype.isValidMove = function (vertex)
{
  return this.isPlayable(vertex) && this.isEmpty(vertex);
}

Board.prototype.lineAt = function (vertex)
{
  if (vertex >= this.rows_ * this.cols_)
    throw "Invalid vertex";
  if (!this.isPlayable(vertex))
    throw "Unplayable vertex";
  return this.grid_[vertex];
}

Board.prototype.filledAt = function (vertex)
{
  if (vertex >= this.rows_ * this.cols_)
    throw "Invalid vertex";
  if (this.isPlayable(vertex))
    throw "Expected unplayable vertex";
  return this.grid_[vertex];
}

Board.prototype.isEmpty = function (vertex)
{
  if (!this.isPlayable(vertex))
    throw "Must have a playable vertex";
  return this.lineAt(vertex) == 0;
}

Board.prototype.isPlayable = function (vertex)
{
  // Every other vertex starting from 1 is playable.
  return !!(vertex & 1);
}

Board.prototype.vertexToRow = function (vertex)
{
  return (vertex / this.cols_) | 0;
}

Board.prototype.vertexToCol = function (vertex)
{
  return (vertex % this.cols_) | 0;
}

Board.prototype.left = function (vertex)
{
  return vertex - 1;
}

Board.prototype.right = function (vertex)
{
  return vertex + 1;
}

Board.prototype.up = function (vertex)
{
  return vertex - this.cols_;
}

Board.prototype.down = function (vertex)
{
  return vertex + this.cols_;
}

Board.prototype.onLeftEdge = function (vertex)
{
  return this.vertexToCol(vertex) == 0;
}

Board.prototype.onRightEdge = function (vertex)
{
  return this.vertexToCol(vertex) == this.cols_ - 1;
}

Board.prototype.onTopEdge = function (vertex)
{
  return vertex < this.cols_;
}

Board.prototype.onBottomEdge = function (vertex)
{
  return vertex >= this.bottom_edge_;
}

Board.prototype.addAdjacent = function (vertex)
{
  // if (this.isPlayable(vertex))
  //   throw "Not playable!";
  // if (this.grid_[this.empty_map_ + vertex] >= 4)
  //   throw "What?! Too many taken edges!";

  // Edges do not contribute to surrounding a square, which makes things a
  // little easier than say Go where edges decrease liberties.
  var taken = this.grid_[this.empty_map_ + vertex] += 1;
  if (taken == 4) {
    this.grid_[vertex] = this.current_player_;
    this.grid_[this.scores_ + this.current_player_] += 1;

    // if (this.capturable_ <= 0)
    //   throw "Took too many squares!";
    this.capturable_--;
  }
}

Board.prototype.playAt = function (vertex)
{
  // if (!this.isValidMove(vertex))
  //   throw "Invalid move!";

  // Remove this vertex from the free list.
  var free_index = this.grid_[this.empty_map_ + vertex];
  // if (this.grid_[this.empty_list_ + free_index] != vertex)
  //   throw "Corrupt free list!"
  
  this.empty_count_--;
  if (free_index != this.empty_count_) {
    // We took the last slot off the end, move it into the old slot.
    var swap_vertex = this.grid_[this.empty_list_ + this.empty_count_];
    this.grid_[this.empty_list_ + free_index] = swap_vertex;
    this.grid_[this.empty_map_ + swap_vertex] = free_index;
  }

  this.grid_[vertex] = this.current_player_;
  var old_score = this.grid_[this.scores_ + this.current_player_];

  // Squares on even rows are not counted, they're dead space. If we're on
  // an odd row, we only have to check left/right, and on even rows, up/down.
  if (this.vertexToRow(vertex) & 1) {
    if (!this.onLeftEdge(vertex))
      this.addAdjacent(this.left(vertex));
    if (!this.onRightEdge(vertex))
      this.addAdjacent(this.right(vertex));
  } else {
    if (!this.onTopEdge(vertex))
      this.addAdjacent(this.up(vertex));
    if (!this.onBottomEdge(vertex))
      this.addAdjacent(this.down(vertex));
  }

  // If the current player didn't score any points, they don't get another
  // turn, so swap sides.
  if (old_score == this.grid_[this.scores_ + this.current_player_])
    this.current_player_ ^= 1;
}

Board.prototype.vertexOf = function (row, col)
{
  if (row >= this.rows_ || col >= this.cols)
    return null;
  return row * this.cols_ + col;
}

Board.prototype.edgeToVertex = function (edge)
{
  if (edge.p1.x == edge.p2.x && edge.p1.y + 1 == edge.p2.y) {
    // Vertical line, pick the odd row.
    return this.vertexOf(edge.p1.y * 2 + 1, edge.p1.x * 2);
  }
  if (edge.p1.x + 1 == edge.p2.x && edge.p1.y == edge.p2.y) {
    // Horizontal line, pick the even row.
    return this.vertexOf(edge.p1.y * 2, edge.p1.x * 2 + 1);
  }
  return null;
}

Board.prototype.vertexToPoint = function (vertex)
{
  var row = this.vertexToRow(vertex);
  var col = this.vertexToCol(vertex);

  return new UI.Point((col / 2) | 0, (row / 2) | 0);
}

Board.prototype.vertexToEdge = function (vertex)
{
  var row = this.vertexToRow(vertex);
  var col = this.vertexToCol(vertex);

  var p1 = new UI.Point((col / 2) | 0, (row / 2) | 0);
  
  // Even rows are horizontal lines, odd are vertical.
  var p2;
  if ((row & 1) == 0)
    p2 = new UI.Point(p1.x + 1, p1.y);
  else
    p2 = new UI.Point(p1.x, p1.y + 1);

  return new UI.Edge(p1, p2);
}

Board.prototype.edges = function ()
{
  var edges = [];
  for (var i = 1; i < this.rows_ * this.cols_; i += 2) {
    var player = this.lineAt(i);
    if (player == 0)
      continue;

    var edge = this.vertexToEdge(i);
    edges.push({ coords: edge, player: player });
  }

  return edges;
}

Board.prototype.filled = function ()
{
  var rects = [];

  for (var i = 0; i < this.rows_ * this.cols_; i += 2) {
    var player = this.filledAt(i);
    if (player == 0)
      continue;

    rects.push({ player: player, point: this.vertexToPoint(i) });
  }

  return rects;
}

Board.prototype.current_player = function ()
{
  return this.current_player_;
}

Board.prototype.dot_rows = function ()
{
  return this.dot_rows_;
}

Board.prototype.dot_cols = function ()
{
  return this.dot_cols_;
}

Board.prototype.dot_area = function ()
{
  return this.dot_rows_ * this.dot_cols_;
}

Board.prototype.score = function (player)
{
  return this.grid_[this.scores_ + player];
}

Board.prototype.game_over = function ()
{
  return this.capturable_ == 0;
}

// This function does a loose evaluation of the board state to see if one
// player is probably going to win.
Board.prototype.evaluate = function()
{
  var difference = this.score(2) - this.score(3);
  if (!difference)
    return 0;
  return difference < 0 ? Board.Player_B : Board.Player_A;
}

Board.prototype.movecount = function ()
{
  return this.max_moves_ - this.empty_count_;
}

// This function shortcuts to determine a winner, in order to speed up AI
// playouts. That is, if a player is so far ahead that the opponent cannot
// win, this will return a winner.
//
// So, the UI should check game_over() before declaring a winner so the game
// isn't declared early.
Board.prototype.winner = function ()
{
  var difference = this.score(2) - this.score(3);

  if (difference && Math.abs(difference) > this.capturable_)
    return difference < 0 ? Board.Player_B : Board.Player_A;

  return 0;
}

// If the current player were to play at this vertex, how many chains would
// that open for the current player?
Board.prototype.opens = function (vertex)
{
}

