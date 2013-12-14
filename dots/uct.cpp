// vim: set ts=8 sts=2 sw=2 tw=99 et: 
#include "uct.h"
#include <math.h>
#include <time.h>
#include <stdlib.h>

using namespace dts;

Node *
Node::findBestChild()
{
  double coeff = sqrt(2) * log(visits);
  Node *best = &children[0];
  double best_score = best->ucb(coeff);

  for (size_t i = 1; i < nchildren; i++) {
    Node *child = &children[i];
    double score = child->ucb(coeff);
    if (score > best_score) {
      best_score = score;
      best = child;
    }
  }

  return best;
}

double
Node::ucb(double coeff) const
{
  return (score / visits) + sqrt(coeff / visits);
}

UCT::UCT(const Board *board, unsigned maxnodes, unsigned maturity)
 : board_(board),
   maturity_(maturity),
   max_history_(board->rows() * board->cols())
{
  assert(maxnodes > 1);
  first_node_ = (Node *)malloc(sizeof(Node) * maxnodes);
  last_node_ = first_node_ + maxnodes;
  cursor_ = first_node_;
  printf("seed: %d\n", time(NULL));
  rand_.seed(1386962552); //time(NULL)); //1386961588); //time(NULL));
}

UCT::~UCT()
{
  free(first_node_);
}

bool
UCT::expand(Node *node, const Board *board)
{
  node->nchildren = board->freeVertices();
  if (!node->nchildren)
    return true;

  node->children = reserve(board->freeVertices());
  if (!node->children) {
    node->nchildren = 0;
    return false;
  }

  for (unsigned i = 0; i < board->freeVertices(); i++) {
    unsigned vertex = board->getFreeVertex(i);
    new (&node->children[i]) Node(board->player(), vertex);
  }

  return true;
}

void
UCT::reset()
{
  cursor_ = first_node_;
}

Player
UCT::playout(Board *shadow)
{
  Player winner;

  while ((winner = shadow->winner()) == Player_None) {
    if (shadow->game_over())
      break;
    if (shadow->move_count() >= 60)
      return shadow->estimate();

    unsigned moves = shadow->freeVertices();
    unsigned rand_int = rand_.randInt() & 0x7FFFFFFF;
    unsigned rand_move = rand_int % moves;
    unsigned vertex = shadow->getFreeVertex(rand_move);
    shadow->playAt(vertex);
  }

  return winner;
}

void
UCT::run_to_playout(Node *root)
{
  Node *node = root;
  Board *shadow = Board::Copy(board_);
  Player winner = Player_None;

  history_.clear();
  history_.push_back(node);

  while (true) {
    if (!node->children) {
      if (node->visits >= maturity_) {
        expand(node, shadow);

        if (!node->children) {
          // Leaf node - go directly to update.
          winner = shadow->winner();
          history_.push_back(node);
          break;
        }
        continue;
      }
      winner = playout(shadow);
      break;
    }
    root = node;
    node = node->findBestChild();
    history_.push_back(node);
    shadow->playAt(node->vertex);
    if ((winner = shadow->winner()) != Player_None)
      break;
  }

  for (size_t i = 0; i < history_.size(); i++) {
    node = history_[i];
    node->visits++;
    if (winner == node->player)
      node->score += 1;
    else if (winner != Player_None)
      node->score -= 1;
  }
}

bool
UCT::run(unsigned *vertex)
{
  // Set up a dummy node as the root.
  Node *root = reserve(1);
  new (root) Node(Player_None, 0);

  if (!expand(root, board_))
    return false;

  for (unsigned i = 0; i < 200000; i++)
    run_to_playout(root);

  double coeff = sqrt(2) * log(root->visits);
  for (size_t i = 0; i < root->nchildren; i++) {
    Node *child = &root->children[i];
    printf("[%d] vertex=%d score=%f visits=%f\n", i,
           child->vertex,
           child->score,
           child->visits);
  }
  *vertex = root->findBestChild()->vertex;
  return true;
}

