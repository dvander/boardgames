// vim: set ts=8 sts=2 sw=2 tw=99 et: 
#ifndef _include_dotsolver_uct_h_
#define _include_dotsolver_uct_h_

#include <assert.h>
#include <stddef.h>
#include "board.h"
#include "MersenneTwister.h"
#include <vector>

namespace dts {

struct Node
{
  double visits;
  double score;
  Node *children;
  size_t nchildren;
  Player player;
  unsigned vertex;

  Node(Player player, unsigned vertex)
   : visits(1),
     score(0),
     children(nullptr),
     nchildren(0),
     player(player),
     vertex(vertex)
  {
  }

  Node *findBestChild();
  double ucb(double coeff) const;
};

class UCT
{
 public:
  UCT(const Board *board, unsigned maxnodes, unsigned maturity);
  ~UCT();

  bool run(unsigned *vertex);

 private:
  void reset();
  void run_to_playout(Node *root);
  Player playout(Board *board);

  Node *reserve(size_t amount) {
    if (cursor_ + amount >= last_node_)
      return nullptr;
    Node *reserved = cursor_;
    cursor_ += amount;
    return reserved;
  }
  bool expand(Node *node, const Board *board);

 private:
  const Board *board_;
  double maturity_;
  unsigned max_history_;

  Node *first_node_;
  Node *last_node_;
  Node *cursor_;

  std::vector<Node *> history_;

  MTRand rand_;
};

} // namespace uct

#endif // _include_dotsolver_uct_h_
