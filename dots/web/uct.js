// vim: set ts=8 sts=2 sw=2 tw=99 et: 
// Copyright (C) 2010-2013 David Anderson 
// dvander@alliedmods.net
//
// UCT Algorithm: Upper Confidence bounds applied to Trees
// Based on "Bandit based Monte-Carlo Planning" by
//   Levente Kocsis and Csaba Szepasvari
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

function UCTNode(player, vertex)
{
  this.visits = 1;
  this.score = 0;
  this.children = null;
  this.player = player;
  this.vertex = vertex;
}

UCTNode.prototype.ucb = function (coeff)
{
  return (this.score / this.visits) + Math.sqrt(coeff / this.visits);
}

UCTNode.prototype.coeff = function ()
{
  // Coefficient in Kocsis et al is sqrt(2).
  return 1.414213562 * Math.log(this.visits);
}

UCTNode.prototype.findMostVisits = function ()
{
  var best = this.children[0];

  for (var i = 1; i < this.children.length; i++) {
    var child = this.children[i];
    if (child.visits > best.visits)
      best = child;
  }

  return best;
}

UCTNode.prototype.findBestChild = function ()
{
  var coeff = this.coeff();
  var best = this.children[0];
  var best_score = best.ucb(coeff);

  for (var i = 1; i < this.children.length; i++) {
    var child = this.children[i];
    var score = child.ucb(coeff);
    if (score > best_score) {
      best_score = score;
      best = child;
    }
  }

  return best;
}

function UCT(board, maxnodes, maturity)
{
  this.board_ = board;
  this.maxnodes_ = maxnodes;
  this.maturity_ = maturity;
  this.history_ = [];
  this.depth_ = 0;
  this.root_ = new UCTNode(0, 0);
  this.mt_ = new MTRand();

  // +1 because we include the root node which represents no move.
  for (var i = 0; i <= this.board_.dot_area(); i++)
    this.history_.push(this.root_);
}

UCT.prototype.expand = function (node, board)
{
  var nvertices = board.freeVertices();
  if (!nvertices)
    return;

  node.children = [];
  for (var i = 0; i < nvertices; i++) {
    var vertex = board.getFreeVertex(i);
    var child = new UCTNode(board.current_player(), vertex);
    node.children.push(child);
  }
}

UCT.prototype.add_history = function (node)
{
  this.history_[this.depth_++] = node;
}

UCT.prototype.playout = function (shadow)
{
  while (true) {
    if (shadow.movecount() >= 60)
      return shadow.evaluate();

    var winner = shadow.winner();
    if (winner || shadow.game_over())
      break;

    var nmoves = shadow.freeVertices();
    var rand_int = this.mt_.randInt();
    var rand_move = (rand_int % nmoves) | 0;
    var vertex = shadow.getFreeVertex(rand_move);
    shadow.playAt(vertex);
  }

  return winner;
}

UCT.prototype.run_to_playout = function (shadow)
{
  var winner = 0;

  this.depth_ = 0;
  this.add_history(this.root_);

  shadow.inherit(this.board_);

  var node = this.root_;
  while (true) {
    if (!node.children) {
      if (node.visits >= this.maturity_) {
        this.expand(node, shadow);

        if (!node.children) {
          // Leaf node - go directly to update.
          winner = shadow.winner();
          this.add_history(node);
          break;
        }
        continue;
      }
      winner = this.playout(shadow);
      break;
    }

    node = node.findBestChild();
    this.add_history(node);
    shadow.playAt(node.vertex);
    if ((winner = shadow.winner()) != 0)
      break;
  }

  for (var i = 0; i < this.depth_; i++) {
    var node = this.history_[i];
    node.visits++;
    if (winner == node.player)
      node.score += 1;
    else if (winner != 0)
      node.score -= 1;
  }
}

UCT.prototype.run = function ()
{
  this.expand(this.root_, this.board_);

  var d = Date.now();
  var shadow = this.board_.clone();
  for (var i = 0; i < 150000; i++)
    this.run_to_playout(shadow);
  document.getElementById('playouts').innerHTML = (150000 / ((Date.now() - d) / 1000) | 0) + ' playouts/sec';
  

  return this.root_.findMostVisits().vertex;
}

